/**
 * At-rest encryption for Dexie. On lock() we snapshot the entire Dexie
 * database, encrypt the JSON payload with the master key (AES-256-GCM) and
 * store the ciphertext in localStorage under `saldo.vaultPayload`. Then wipe
 * Dexie tables. On unlock() we reverse: decrypt → restore tables via bulkAdd.
 *
 * Design choices:
 *   - The snapshot JSON is schema-versioned (SaldoSnapshot v2). Restore uses
 *     parseSnapshot so future schema upgrades degrade gracefully.
 *   - A backup of the previous ciphertext is kept under
 *     `saldo.vaultPayloadBackup` so a failed decrypt doesn't destroy data.
 *     decryptAndRestore falls back to that backup when the primary payload
 *     cannot be verified.
 *   - Between unlock() and lock() Dexie holds plaintext. The app already
 *     auto-locks after inactivity and on visibility hidden, so the window is
 *     bounded. hasPlaintextData() + boot() together detect hard-kill residue
 *     so the app can wipe it before the user unlocks.
 */
import { db } from '@/db/database';
import { parseSnapshot, serializeSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { decryptPayload, encryptPayload, type EncryptedPayload } from './vault';

const SNAPSHOT_KEY = 'saldo.vaultPayload';
const BACKUP_KEY = 'saldo.vaultPayloadBackup';

const ALL_TABLE_NAMES = [
  'transactions',
  'accounts',
  'categories',
  'categoryGroups',
  'budgets',
  'goals',
  'loans',
  'rules',
  'subscriptions',
  'recurring',
  'balances',
  'txTombstones',
] as const;

type TableName = (typeof ALL_TABLE_NAMES)[number];

function allTables() {
  return ALL_TABLE_NAMES.map((n) => db[n as TableName]);
}

function ls(): Storage | null {
  return typeof localStorage !== 'undefined' ? localStorage : null;
}

export function hasEncryptedSnapshot(): boolean {
  return !!ls()?.getItem(SNAPSHOT_KEY);
}

export function clearEncryptedSnapshot(): void {
  const s = ls();
  if (!s) return;
  s.removeItem(SNAPSHOT_KEY);
  s.removeItem(BACKUP_KEY);
}

/**
 * True when Dexie is reachable and any user-data table has rows. Used by
 * boot() to detect hard-kill residue (Dexie plaintext without an in-memory
 * master) and wipe it before letting the user into the lock screen.
 */
export async function hasPlaintextData(): Promise<boolean> {
  try {
    for (const name of ALL_TABLE_NAMES) {
      const count = await db[name as TableName].count();
      if (count > 0) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function buildSnapshot(): Promise<SaldoSnapshot> {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    accounts: await db.accounts.toArray(),
    categoryGroups: await db.categoryGroups.toArray(),
    categories: await db.categories.toArray(),
    transactions: await db.transactions.toArray(),
    budgets: await db.budgets.toArray(),
    goals: await db.goals.toArray(),
    rules: await db.rules.toArray(),
    subscriptions: await db.subscriptions.toArray(),
    loans: await db.loans.toArray(),
    balances: await db.balances.toArray(),
    txTombstones: await db.txTombstones.toArray(),
    recurring: await db.recurring.toArray(),
  };
}

export async function wipeTables(): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    await Promise.all(ALL_TABLE_NAMES.map((n) => db[n as TableName].clear()));
  });
}

async function restoreSnapshot(s: SaldoSnapshot): Promise<void> {
  await db.transaction('rw', allTables(), async () => {
    // Fresh tables — drop any plaintext residue before hydrating.
    await Promise.all(ALL_TABLE_NAMES.map((n) => db[n as TableName].clear()));
    if (s.accounts.length) await db.accounts.bulkAdd(s.accounts);
    if (s.categoryGroups.length) await db.categoryGroups.bulkAdd(s.categoryGroups);
    if (s.categories.length) await db.categories.bulkAdd(s.categories);
    if (s.transactions.length) await db.transactions.bulkAdd(s.transactions);
    if (s.budgets.length) await db.budgets.bulkAdd(s.budgets);
    if (s.goals.length) await db.goals.bulkAdd(s.goals);
    if (s.rules.length) await db.rules.bulkAdd(s.rules);
    if (s.subscriptions.length) await db.subscriptions.bulkAdd(s.subscriptions);
    if (s.loans.length) await db.loans.bulkAdd(s.loans);
    if (s.balances.length) await db.balances.bulkAdd(s.balances);
    if (s.txTombstones && s.txTombstones.length) {
      await db.txTombstones.bulkAdd(s.txTombstones);
    }
    if (s.recurring && s.recurring.length) {
      await db.recurring.bulkAdd(s.recurring);
    }
  });
}

/**
 * Encrypts a fresh snapshot to localStorage (keeping the previous payload as
 * backup for one generation) and wipes Dexie tables. Master key is not
 * persisted anywhere — caller nullifies it afterwards.
 */
export async function encryptAndWipe(master: CryptoKey): Promise<void> {
  const snapshot = await buildSnapshot();
  const json = serializeSnapshot(snapshot);
  const bytes = new TextEncoder().encode(json);
  const payload = await encryptPayload(bytes, master);
  const s = ls();
  if (!s) throw new Error('localStorage no disponible.');
  const prev = s.getItem(SNAPSHOT_KEY);
  if (prev) s.setItem(BACKUP_KEY, prev);
  s.setItem(SNAPSHOT_KEY, JSON.stringify(payload));
  await wipeTables();
}

async function decryptFromKey(master: CryptoKey, key: string): Promise<SaldoSnapshot | null> {
  const s = ls();
  if (!s) return null;
  const raw = s.getItem(key);
  if (!raw) return null;
  let parsed: EncryptedPayload;
  try {
    parsed = JSON.parse(raw) as EncryptedPayload;
  } catch {
    throw new Error('vault snapshot corrupt (JSON)');
  }
  const plain = await decryptPayload(parsed.ct, parsed.iv, master, parsed.sha);
  return parseSnapshot(new TextDecoder().decode(plain));
}

/**
 * Decrypts and restores Dexie tables from the encrypted snapshot. Returns
 * false when no snapshot exists (first unlock after setup) so the caller
 * doesn't treat the empty state as data loss.
 *
 * If the primary payload fails verification (checksum mismatch, JSON corrupt,
 * GCM auth failure) we transparently fall back to the one-generation backup
 * under `saldo.vaultPayloadBackup`. Only when both fail do we propagate the
 * original error so the caller can surface it to the UI.
 */
export async function decryptAndRestore(master: CryptoKey): Promise<boolean> {
  const s = ls();
  if (!s) return false;
  if (!s.getItem(SNAPSHOT_KEY) && !s.getItem(BACKUP_KEY)) return false;

  let snapshot: SaldoSnapshot | null = null;
  let primaryError: unknown = null;
  try {
    snapshot = await decryptFromKey(master, SNAPSHOT_KEY);
  } catch (e) {
    primaryError = e;
  }
  if (!snapshot) {
    try {
      snapshot = await decryptFromKey(master, BACKUP_KEY);
    } catch {
      // fall through with primaryError
    }
  }
  if (!snapshot) {
    if (primaryError) throw primaryError;
    return false;
  }
  await restoreSnapshot(snapshot);
  return true;
}
