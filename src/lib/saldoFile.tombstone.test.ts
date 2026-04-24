import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { resetDb } from '@/test/resetDb';
import { parseSnapshot, serializeSnapshot, type SaldoSnapshot } from './saldoFile';

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

/** Minimal valid snapshot shell — all required arrays present. */
function makeMinimalSnapshot(overrides: Partial<SaldoSnapshot> = {}): SaldoSnapshot {
  return {
    version: 2,
    exportedAt: '2026-01-01T00:00:00.000Z',
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
    txTombstones: [],
    recurring: [],
    ...overrides,
  };
}

describe('serializeSnapshot / parseSnapshot — tombstones', () => {
  it('should include txTombstones in serialized output when present', () => {
    // Arrange
    const snap = makeMinimalSnapshot({
      txTombstones: [{ txHash: 'abc123', deletedAt: 1000 }],
    });

    // Act
    const json = serializeSnapshot(snap);
    const parsed = JSON.parse(json) as { txTombstones?: unknown[] };

    // Assert
    expect(parsed.txTombstones).toHaveLength(1);
    expect(parsed.txTombstones![0]).toMatchObject({ txHash: 'abc123', deletedAt: 1000 });
  });

  it('should return empty txTombstones array when v1 snapshot has no txTombstones field', () => {
    // Arrange — version 1 payload without txTombstones
    const raw = JSON.stringify({
      version: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
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
    });

    // Act
    const snap = parseSnapshot(raw);

    // Assert
    expect(snap.txTombstones).toEqual([]);
  });

  it('should preserve tombstones when round-tripping a v2 snapshot', () => {
    // Arrange
    const tombstones = [
      { txHash: 'hash-a', deletedAt: 1111 },
      { txHash: 'hash-b', deletedAt: 2222 },
    ];
    const snap = makeMinimalSnapshot({ txTombstones: tombstones });
    const raw = serializeSnapshot(snap);

    // Act
    const restored = parseSnapshot(raw);

    // Assert
    expect(restored.txTombstones).toHaveLength(2);
    expect(restored.txTombstones![0]).toMatchObject({ txHash: 'hash-a', deletedAt: 1111 });
    expect(restored.txTombstones![1]).toMatchObject({ txHash: 'hash-b', deletedAt: 2222 });
  });

  it('should persist txHash and deletedAt when writing a tombstone to Dexie', async () => {
    // Arrange + Act
    const id = await db.txTombstones.add({ txHash: 'deadbeef', deletedAt: 9999 });

    // Assert
    const row = await db.txTombstones.get(id);
    expect(row).toBeDefined();
    expect(row?.txHash).toBe('deadbeef');
    expect(row?.deletedAt).toBe(9999);
  });

  it('should preserve tombstones through export → wipe → import cycle', async () => {
    // Arrange — seed tombstones in Dexie
    await db.txTombstones.bulkAdd([
      { txHash: 'abc', deletedAt: 100 },
      { txHash: 'def', deletedAt: 200 },
    ]);

    // Build snapshot from live DB
    const snap = makeMinimalSnapshot({
      txTombstones: await db.txTombstones.toArray(),
    });
    const raw = serializeSnapshot(snap);

    // Wipe
    await resetDb();
    expect(await db.txTombstones.count()).toBe(0);

    // Import
    const restored = parseSnapshot(raw);
    await db.txTombstones.bulkAdd(restored.txTombstones!);

    // Assert tombstones survived the round-trip
    const rows = await db.txTombstones.toArray();
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.txHash === 'abc')?.deletedAt).toBe(100);
    expect(rows.find((r) => r.txHash === 'def')?.deletedAt).toBe(200);
  });

  it('should reject a second add with the same txHash because of the unique index', async () => {
    // Arrange — first insert succeeds
    await db.txTombstones.add({ txHash: 'duplicate-hash', deletedAt: 1 });

    // Act + Assert — second insert with same txHash must fail
    await expect(db.txTombstones.add({ txHash: 'duplicate-hash', deletedAt: 2 })).rejects.toThrow();

    // Verify only one row exists
    const count = await db.txTombstones.where('txHash').equals('duplicate-hash').count();
    expect(count).toBe(1);
  });
});
