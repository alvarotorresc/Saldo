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
 *   - Between unlock() and lock() Dexie holds plaintext. The app already
 *     auto-locks after inactivity and on visibility hidden, so the window is
 *     bounded. Hard-kill + boot → boot() reports plaintextHydrated so the UI
 *     forces an unlock anyway and the next lock re-encrypts.
 */
import { db } from '@/db/database';
import { parseSnapshot, serializeSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { decryptPayload, encryptPayload, type EncryptedPayload } from './vault';

const SNAPSHOT_KEY = 'saldo.vaultPayload';
const BACKUP_KEY = 'saldo.vaultPayloadBackup';

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
  };
}

async function wipeTables(): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.transactions,
      db.accounts,
      db.categories,
      db.categoryGroups,
      db.budgets,
      db.goals,
      db.loans,
      db.rules,
      db.subscriptions,
      db.recurring,
      db.balances,
      db.txTombstones,
    ],
    async () => {
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.categories.clear(),
        db.categoryGroups.clear(),
        db.budgets.clear(),
        db.goals.clear(),
        db.loans.clear(),
        db.rules.clear(),
        db.subscriptions.clear(),
        db.recurring.clear(),
        db.balances.clear(),
        db.txTombstones.clear(),
      ]);
    },
  );
}

async function restoreSnapshot(s: SaldoSnapshot): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.transactions,
      db.accounts,
      db.categories,
      db.categoryGroups,
      db.budgets,
      db.goals,
      db.loans,
      db.rules,
      db.subscriptions,
      db.balances,
      db.txTombstones,
    ],
    async () => {
      // Fresh tables — drop any plaintext residue before hydrating.
      await Promise.all([
        db.transactions.clear(),
        db.accounts.clear(),
        db.categories.clear(),
        db.categoryGroups.clear(),
        db.budgets.clear(),
        db.goals.clear(),
        db.loans.clear(),
        db.rules.clear(),
        db.subscriptions.clear(),
        db.balances.clear(),
        db.txTombstones.clear(),
      ]);
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
    },
  );
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

/**
 * Decrypts and restores Dexie tables from the encrypted snapshot. Returns
 * false when no snapshot exists (first unlock after setup) so the caller
 * doesn't treat the empty state as data loss.
 */
export async function decryptAndRestore(master: CryptoKey): Promise<boolean> {
  const s = ls();
  if (!s) return false;
  const raw = s.getItem(SNAPSHOT_KEY);
  if (!raw) return false;
  let parsed: EncryptedPayload;
  try {
    parsed = JSON.parse(raw) as EncryptedPayload;
  } catch {
    throw new Error('vault snapshot corrupt (JSON)');
  }
  const plain = await decryptPayload(parsed.ct, parsed.iv, master, parsed.sha);
  const snapshot = parseSnapshot(new TextDecoder().decode(plain));
  await restoreSnapshot(snapshot);
  return true;
}
