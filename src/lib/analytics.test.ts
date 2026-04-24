import { describe, it, expect } from 'vitest';
import { categoryYoy, runningNetSeries, topMerchants } from './analytics';
import type { Transaction } from '@/types';

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'kind' | 'date'>,
): Transaction {
  return {
    accountId: 1,
    description: 'x',
    createdAt: 0,
    month: partial.date.slice(0, 7),
    ...partial,
  } as Transaction;
}

describe('topMerchants', () => {
  const rows: Transaction[] = [
    tx({ date: '2026-04-01', amount: 20, kind: 'expense', merchant: 'Lidl' }),
    tx({ date: '2026-04-02', amount: 30, kind: 'expense', merchant: 'Lidl' }),
    tx({ date: '2026-04-03', amount: 80, kind: 'expense', merchant: 'Mercadona' }),
    tx({ date: '2026-04-03', amount: 1000, kind: 'income', merchant: 'ACME' }),
  ];

  it('sums expenses by merchant and sorts by total desc', () => {
    const out = topMerchants(rows);
    expect(out[0]).toEqual({ merchant: 'Mercadona', total: 80, count: 1 });
    expect(out[1]).toEqual({ merchant: 'Lidl', total: 50, count: 2 });
    expect(out.length).toBe(2);
  });

  it('respects the limit parameter', () => {
    expect(topMerchants(rows, 1)).toHaveLength(1);
  });
});

describe('categoryYoy', () => {
  it('computes deltaPct for matching categories across periods', () => {
    const current: Transaction[] = [
      tx({ date: '2026-04-01', amount: 100, kind: 'expense', categoryId: 1 }),
      tx({ date: '2026-04-01', amount: 40, kind: 'expense', categoryId: 2 }),
    ];
    const prev: Transaction[] = [
      tx({ date: '2025-04-01', amount: 50, kind: 'expense', categoryId: 1 }),
    ];
    const out = categoryYoy(current, prev);
    const cat1 = out.find((o) => o.categoryId === 1)!;
    expect(cat1.deltaPct).toBeCloseTo(1, 5);
    const cat2 = out.find((o) => o.categoryId === 2)!;
    expect(cat2.deltaPct).toBe(1); // no prev data → treat as +100%
  });
});

describe('runningNetSeries', () => {
  it('tracks cumulative net across expenses and incomes in chronological order', () => {
    const rows: Transaction[] = [
      tx({ date: '2026-04-02', amount: 200, kind: 'expense' }),
      tx({ date: '2026-04-01', amount: 1000, kind: 'income' }),
      tx({ date: '2026-04-03', amount: 50, kind: 'expense' }),
    ];
    expect(runningNetSeries(rows)).toEqual([1000, 800, 750]);
  });

  it('returns an empty array for no rows', () => {
    expect(runningNetSeries([])).toEqual([]);
  });
});
