import { describe, it, expect } from 'vitest';
import { parseSnapshot, serializeSnapshot, type SaldoSnapshot } from './saldoFile';

const sample: SaldoSnapshot = {
  version: 2,
  exportedAt: '2026-04-24T00:00:00Z',
  accounts: [{ id: 1, name: 'Cuenta principal', bank: 'manual', currency: 'EUR', createdAt: 0 }],
  categoryGroups: [],
  categories: [],
  transactions: [
    {
      id: 1,
      accountId: 1,
      date: '2026-04-01',
      amount: 10,
      kind: 'expense',
      description: 'x',
      month: '2026-04',
      createdAt: 0,
    },
  ],
  budgets: [],
  goals: [],
  rules: [],
  subscriptions: [],
  loans: [],
  balances: [],
  txTombstones: [{ id: 1, txHash: 'abc123', deletedAt: 1_700_000_000_000 }],
  recurring: [],
};

describe('saldoFile round-trip', () => {
  it('serialize → parse preserves the snapshot byte-for-byte payload-equal', () => {
    const roundtrip = parseSnapshot(serializeSnapshot(sample));
    expect(roundtrip).toEqual(sample);
  });

  it('throws a descriptive error on invalid JSON', () => {
    expect(() => parseSnapshot('{{{')).toThrow(/valid JSON/);
  });

  it('throws on unsupported version', () => {
    const blob = JSON.stringify({ ...sample, version: 999 });
    expect(() => parseSnapshot(blob)).toThrow(/Unsupported/);
  });

  it('throws when a required table is missing', () => {
    const blob = JSON.stringify({ ...sample, transactions: undefined });
    expect(() => parseSnapshot(blob)).toThrow(/transactions/);
  });

  it('preserves txTombstones across round-trip for v2', () => {
    const out = parseSnapshot(serializeSnapshot(sample));
    expect(out.txTombstones).toEqual([{ id: 1, txHash: 'abc123', deletedAt: 1_700_000_000_000 }]);
  });

  it('accepts v1 snapshots (pre-tombstone) and defaults txTombstones to []', () => {
    const { txTombstones, recurring, ...rest } = sample;
    void txTombstones;
    void recurring;
    const legacy = JSON.stringify({ ...rest, version: 1 });
    const out = parseSnapshot(legacy);
    expect(out.version).toBe(1);
    expect(out.txTombstones).toEqual([]);
    expect(out.recurring).toEqual([]);
  });

  it('preserves db.recurring across round-trip (C-BLK-001 regression)', () => {
    const withRecurring: SaldoSnapshot = {
      ...sample,
      recurring: [
        {
          id: 1,
          signature: 'spotify',
          averageAmount: 9.99,
          cadenceDays: 30,
          lastSeen: '2026-04-01',
          sampleCount: 6,
          kind: 'expense',
        },
      ],
    };
    const out = parseSnapshot(serializeSnapshot(withRecurring));
    expect(out.recurring).toEqual(withRecurring.recurring);
  });
});
