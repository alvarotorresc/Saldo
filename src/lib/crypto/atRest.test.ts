import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { db } from '@/db/database';
import { resetDb } from '@/test/resetDb';
import { generateMasterKey } from './key';
import { encryptPayload } from './vault';
import {
  buildSnapshot,
  clearEncryptedSnapshot,
  decryptAndRestore,
  encryptAndWipe,
  hasEncryptedSnapshot,
  hasPlaintextData,
} from './atRest';

const PRIMARY_KEY = 'saldo.vaultPayload';
const BACKUP_KEY = 'saldo.vaultPayloadBackup';

beforeEach(async () => {
  localStorage.clear();
  await resetDb();
});

afterEach(() => {
  localStorage.clear();
});

describe('atRest.encryptAndWipe + decryptAndRestore', () => {
  it('round-trips a snapshot through localStorage and Dexie tables', async () => {
    const accountId = await db.accounts.add({
      name: 'Cuenta principal',
      bank: 'manual',
      currency: 'EUR',
      createdAt: 0,
    });
    await db.transactions.add({
      accountId: accountId as number,
      date: '2026-04-01',
      amount: 10,
      kind: 'expense',
      description: 'Lidl',
      month: '2026-04',
      createdAt: 0,
    });

    const master = await generateMasterKey();
    await encryptAndWipe(master);

    expect(await db.accounts.count()).toBe(0);
    expect(await db.transactions.count()).toBe(0);
    expect(hasEncryptedSnapshot()).toBe(true);

    const ok = await decryptAndRestore(master);
    expect(ok).toBe(true);
    expect(await db.accounts.count()).toBe(1);
    expect(await db.transactions.count()).toBe(1);
  });

  it('returns false when no snapshot is present (first unlock)', async () => {
    const master = await generateMasterKey();
    expect(await decryptAndRestore(master)).toBe(false);
  });

  it('throws on checksum mismatch to prevent silent corruption', async () => {
    const master = await generateMasterKey();
    const bytes = new TextEncoder().encode('{"corrupt":true}');
    const payload = await encryptPayload(bytes, master);
    localStorage.setItem(PRIMARY_KEY, JSON.stringify({ ...payload, sha: 'AAAA' }));
    await expect(decryptAndRestore(master)).rejects.toThrow(/Checksum|valid JSON|Unsupported/);
  });

  it('clearEncryptedSnapshot wipes both current and backup entries', () => {
    localStorage.setItem(PRIMARY_KEY, 'x');
    localStorage.setItem(BACKUP_KEY, 'y');
    clearEncryptedSnapshot();
    expect(localStorage.getItem(PRIMARY_KEY)).toBeNull();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();
  });
});

// GAP-003 — round-trip exhaustivo
describe('atRest — GAP-003 edge cases', () => {
  it('preserves txTombstones across encrypt-wipe-decrypt-restore', async () => {
    await db.txTombstones.add({ txHash: 'abc123', deletedAt: 1700000000000 });
    const master = await generateMasterKey();
    await encryptAndWipe(master);
    expect(await db.txTombstones.count()).toBe(0);
    await decryptAndRestore(master);
    const rows = await db.txTombstones.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.txHash).toBe('abc123');
    expect(rows[0]!.deletedAt).toBe(1700000000000);
  });

  it('preserves db.recurring across the round-trip (C-BLK-001 regression)', async () => {
    await db.recurring.add({
      signature: 'netflix',
      averageAmount: 12.99,
      cadenceDays: 30,
      lastSeen: '2026-04-01',
      sampleCount: 6,
      kind: 'expense',
    });
    const master = await generateMasterKey();
    await encryptAndWipe(master);
    expect(await db.recurring.count()).toBe(0);
    await decryptAndRestore(master);
    const rows = await db.recurring.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]!.signature).toBe('netflix');
    expect(rows[0]!.averageAmount).toBeCloseTo(12.99);
  });

  it('keeps the previous ciphertext as backup when encryptAndWipe runs twice', async () => {
    const master = await generateMasterKey();
    await db.accounts.add({ name: 'A', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await encryptAndWipe(master);
    const first = localStorage.getItem(PRIMARY_KEY);
    expect(first).not.toBeNull();
    expect(localStorage.getItem(BACKUP_KEY)).toBeNull();

    // simulate a new session — restore and lock again.
    await decryptAndRestore(master);
    await db.accounts.add({ name: 'B', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await encryptAndWipe(master);

    expect(localStorage.getItem(BACKUP_KEY)).toBe(first);
    expect(localStorage.getItem(PRIMARY_KEY)).not.toBe(first);
  });

  it('throws "vault snapshot corrupt (JSON)" when primary is not valid JSON', async () => {
    localStorage.setItem(PRIMARY_KEY, 'not-json-at-all');
    const master = await generateMasterKey();
    await expect(decryptAndRestore(master)).rejects.toThrow(/corrupt|JSON/);
  });

  it('falls back to BACKUP_KEY when primary checksum fails (S-MEDIO-003)', async () => {
    const master = await generateMasterKey();
    await db.accounts.add({ name: 'OK', bank: 'manual', currency: 'EUR', createdAt: 0 });
    await encryptAndWipe(master);
    // at this point PRIMARY holds the good payload and BACKUP is empty.
    // Fake a second gen: snapshot the primary as backup, then tamper with primary.
    const goodPayload = localStorage.getItem(PRIMARY_KEY)!;
    localStorage.setItem(BACKUP_KEY, goodPayload);
    const parsed = JSON.parse(goodPayload);
    localStorage.setItem(PRIMARY_KEY, JSON.stringify({ ...parsed, sha: 'AAAA' }));

    const ok = await decryptAndRestore(master);
    expect(ok).toBe(true);
    const accounts = await db.accounts.toArray();
    expect(accounts).toHaveLength(1);
    expect(accounts[0]!.name).toBe('OK');
  });

  it('buildSnapshot is stable — empty DB produces an array for every table', async () => {
    const snap = await buildSnapshot();
    expect(snap.version).toBe(2);
    expect(Array.isArray(snap.accounts)).toBe(true);
    expect(Array.isArray(snap.recurring)).toBe(true);
    expect(Array.isArray(snap.txTombstones)).toBe(true);
  });
});

describe('hasPlaintextData', () => {
  it('is false on a fresh DB', async () => {
    expect(await hasPlaintextData()).toBe(false);
  });

  it('becomes true as soon as any tracked table has a row', async () => {
    await db.accounts.add({ name: 'X', bank: 'manual', currency: 'EUR', createdAt: 0 });
    expect(await hasPlaintextData()).toBe(true);
  });
});

describe('parseSnapshot shape', () => {
  it('is still callable after atRest loads (no cyclic import)', () => {
    const s: SaldoSnapshot = parseSnapshot(
      JSON.stringify({
        version: 2,
        exportedAt: 'x',
        accounts: [],
        categoryGroups: [],
        categories: [],
        transactions: [],
        budgets: [],
        goals: [],
        rules: [],
        subscriptions: [],
        loans: [],
        balances: [],
      }),
    );
    expect(s.version).toBe(2);
  });
});
