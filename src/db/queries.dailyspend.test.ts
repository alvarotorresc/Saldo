import { describe, it, expect } from 'vitest';
import { dailySpendFromRows } from './queries';
import type { Transaction } from '@/types';

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'kind'>,
): Transaction {
  const month = partial.month ?? partial.date.slice(0, 7);
  return {
    accountId: 1,
    description: 'x',
    createdAt: 0,
    ...partial,
    month,
  } as Transaction;
}

describe('dailySpendFromRows', () => {
  it('returns array of length equal to days of the month (April, 30 days)', () => {
    const out = dailySpendFromRows([], '2026-04');
    expect(out).toHaveLength(30);
    expect(out.every((v) => v === 0)).toBe(true);
  });

  it('returns 31 entries for a 31-day month and sums expenses on the correct day', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-05-01', amount: 10, kind: 'expense' }),
      tx({ date: '2026-05-01', amount: 5, kind: 'expense' }),
      tx({ date: '2026-05-31', amount: 42, kind: 'expense' }),
    ];
    const out = dailySpendFromRows(rows, '2026-05');
    expect(out).toHaveLength(31);
    expect(out[0]).toBe(15);
    expect(out[30]).toBe(42);
    expect(out[15]).toBe(0);
  });

  it('handles a leap-year February (29 days)', () => {
    const out = dailySpendFromRows(
      [tx({ date: '2024-02-29', amount: 7, kind: 'expense' })],
      '2024-02',
    );
    expect(out).toHaveLength(29);
    expect(out[28]).toBe(7);
  });

  it('handles a non-leap February (28 days)', () => {
    const out = dailySpendFromRows([], '2026-02');
    expect(out).toHaveLength(28);
  });

  it('ignores income, reimbursements, other months, and uses personalAmount when split', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-10', amount: 100, kind: 'income' }),
      tx({ date: '2026-04-10', amount: 80, kind: 'expense', personalAmount: 30 }),
      tx({ date: '2026-04-10', amount: 20, kind: 'transfer' as const }),
      tx({ date: '2026-03-10', amount: 500, kind: 'expense', month: '2026-03' }),
    ];
    const out = dailySpendFromRows(rows, '2026-04');
    expect(out[9]).toBe(30);
    expect(out.reduce((a, b) => a + b, 0)).toBe(30);
  });
});
