import { describe, it, expect, vi, beforeEach } from 'vitest';
import { parseSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { generateMasterKey } from './key';
import { encryptPayload } from './vault';

// Mock Dexie so atRest.ts can drive buildSnapshot / wipeTables / restore
// without a real IndexedDB. Each table exposes a tiny in-memory array plus
// the minimum API surface atRest.ts uses.
interface FakeTable<T> {
  _rows: T[];
  toArray(): Promise<T[]>;
  clear(): Promise<void>;
  bulkAdd(rows: T[]): Promise<void>;
}

function table<T>(): FakeTable<T> {
  return {
    _rows: [],
    async toArray() {
      return this._rows;
    },
    async clear() {
      this._rows = [];
    },
    async bulkAdd(rows) {
      this._rows.push(...rows);
    },
  };
}

const fakeDb = {
  transactions: table<unknown>(),
  accounts: table<unknown>(),
  categories: table<unknown>(),
  categoryGroups: table<unknown>(),
  budgets: table<unknown>(),
  goals: table<unknown>(),
  loans: table<unknown>(),
  rules: table<unknown>(),
  subscriptions: table<unknown>(),
  recurring: table<unknown>(),
  balances: table<unknown>(),
  txTombstones: table<unknown>(),
  async transaction(_mode: 'rw', _tables: unknown, fn: () => Promise<void>) {
    await fn();
  },
};

vi.mock('@/db/database', () => ({ db: fakeDb }));

const atRest = await import('./atRest');

beforeEach(() => {
  Object.values(fakeDb).forEach((t) => {
    if (t && typeof (t as FakeTable<unknown>).clear === 'function') {
      (t as FakeTable<unknown>)._rows = [];
    }
  });
  localStorage.clear();
});

describe('atRest.encryptAndWipe + decryptAndRestore', () => {
  it('round-trips a snapshot through localStorage and Dexie tables', async () => {
    // Seed some plaintext data.
    (fakeDb.accounts as FakeTable<unknown>)._rows = [
      { id: 1, name: 'Cuenta principal', bank: 'manual', currency: 'EUR', createdAt: 0 },
    ];
    (fakeDb.transactions as FakeTable<unknown>)._rows = [
      {
        id: 1,
        accountId: 1,
        date: '2026-04-01',
        amount: 10,
        kind: 'expense',
        description: 'Lidl',
        month: '2026-04',
        createdAt: 0,
      },
    ];

    const master = await generateMasterKey();
    await atRest.encryptAndWipe(master);

    // Dexie cleared, localStorage populated.
    expect((fakeDb.accounts as FakeTable<unknown>)._rows).toHaveLength(0);
    expect((fakeDb.transactions as FakeTable<unknown>)._rows).toHaveLength(0);
    expect(atRest.hasEncryptedSnapshot()).toBe(true);

    // Restore into an empty DB.
    const ok = await atRest.decryptAndRestore(master);
    expect(ok).toBe(true);
    expect((fakeDb.accounts as FakeTable<unknown>)._rows).toHaveLength(1);
    expect((fakeDb.transactions as FakeTable<unknown>)._rows).toHaveLength(1);
  });

  it('returns false when no snapshot is present (first unlock)', async () => {
    const master = await generateMasterKey();
    expect(await atRest.decryptAndRestore(master)).toBe(false);
  });

  it('throws on checksum mismatch to prevent silent corruption', async () => {
    const master = await generateMasterKey();
    // Hand-craft a ciphertext with a bogus sha.
    const bytes = new TextEncoder().encode('{"corrupt":true}');
    const payload = await encryptPayload(bytes, master);
    localStorage.setItem('saldo.vaultPayload', JSON.stringify({ ...payload, sha: 'AAAA' }));
    await expect(atRest.decryptAndRestore(master)).rejects.toThrow(
      /Checksum|valid JSON|Unsupported/,
    );
  });

  it('clearEncryptedSnapshot wipes both current and backup entries', () => {
    localStorage.setItem('saldo.vaultPayload', 'x');
    localStorage.setItem('saldo.vaultPayloadBackup', 'y');
    atRest.clearEncryptedSnapshot();
    expect(localStorage.getItem('saldo.vaultPayload')).toBeNull();
    expect(localStorage.getItem('saldo.vaultPayloadBackup')).toBeNull();
  });
});

describe('parseSnapshot shape', () => {
  it('is still callable after atRest loads (no cyclic import)', () => {
    // Sanity that our imports didn't break module init.
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
