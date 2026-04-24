import { describe, it, expect } from 'vitest';
import { dailySpendSeriesFromRows, monthlyInOutFromRows } from './queries';
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

describe('dailySpendSeriesFromRows', () => {
  it('returns a series of requested length ending at endDateISO, oldest first', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-20', amount: 10, kind: 'expense' }),
      tx({ date: '2026-04-24', amount: 7, kind: 'expense' }),
    ];
    const out = dailySpendSeriesFromRows(rows, '2026-04-24', 7);
    expect(out).toHaveLength(7);
    // 2026-04-18..2026-04-24 → indices 0..6
    expect(out[2]).toBe(10); // 2026-04-20
    expect(out[6]).toBe(7); // 2026-04-24
    expect(out[0]).toBe(0);
  });

  it('ignores income, transfers, reimbursements and dates outside the window', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-24', amount: 100, kind: 'income' }),
      tx({ date: '2026-04-24', amount: 50, kind: 'transfer' }),
      tx({ date: '2026-04-24', amount: 40, kind: 'expense', personalAmount: 15 }),
      tx({ date: '2026-03-10', amount: 500, kind: 'expense' }),
    ];
    const out = dailySpendSeriesFromRows(rows, '2026-04-24', 7);
    expect(out[6]).toBe(15);
    expect(out.reduce((a, b) => a + b, 0)).toBe(15);
  });

  it('returns an all-zero array of length 1 for days=0 (guarded)', () => {
    const out = dailySpendSeriesFromRows([], '2026-04-24', 0);
    expect(out).toEqual([0]);
  });

  it('handles a YTD-style 100-day window crossing month boundaries', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-01-20', amount: 1, kind: 'expense' }),
      tx({ date: '2026-02-15', amount: 2, kind: 'expense' }),
      tx({ date: '2026-04-24', amount: 4, kind: 'expense' }),
    ];
    const out = dailySpendSeriesFromRows(rows, '2026-04-24', 100);
    expect(out).toHaveLength(100);
    expect(out[99]).toBe(4);
    expect(out.reduce((a, b) => a + b, 0)).toBe(7);
  });
});

describe('monthlyInOutFromRows', () => {
  it('builds 12 monthly buckets ending at the requested month, oldest first', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-01', amount: 100, kind: 'expense' }),
      tx({ date: '2026-04-05', amount: 2000, kind: 'income' }),
      tx({ date: '2026-03-10', amount: 40, kind: 'expense' }),
    ];
    const out = monthlyInOutFromRows(rows, '2026-04');
    expect(out).toHaveLength(12);
    expect(out[out.length - 1]).toEqual({ month: '2026-04', income: 2000, expense: 100 });
    const march = out.find((b) => b.month === '2026-03');
    expect(march).toEqual({ month: '2026-03', income: 0, expense: 40 });
    expect(out[0].month).toBe('2025-05');
  });

  it('drops reimbursement income and includes split expenses at personalAmount', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-05', amount: 40, kind: 'income', reimbursementFor: 7 }),
      tx({ date: '2026-04-05', amount: 100, kind: 'expense', personalAmount: 30 }),
    ];
    const out = monthlyInOutFromRows(rows, '2026-04');
    const april = out[out.length - 1];
    expect(april.income).toBe(0);
    expect(april.expense).toBe(30);
  });
});
