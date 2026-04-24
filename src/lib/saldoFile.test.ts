import { describe, it, expect } from 'vitest';
import { parseSnapshot, serializeSnapshot, type SaldoSnapshot } from './saldoFile';

const sample: SaldoSnapshot = {
  version: 1,
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
});
