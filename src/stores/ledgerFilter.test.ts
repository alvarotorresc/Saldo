import { describe, it, expect, beforeEach } from 'vitest';
import {
  EMPTY_FILTER,
  activeFilterCount,
  matchesFilter,
  useLedgerFilter,
  type LedgerFilterState,
} from './ledgerFilter';
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

beforeEach(() => {
  useLedgerFilter.getState().reset();
});

describe('matchesFilter', () => {
  const t = tx({ date: '2026-04-10', amount: 50, kind: 'expense', categoryId: 3 });

  it('accepts every tx when the filter is empty and period=current on the active month', () => {
    expect(matchesFilter(t, EMPTY_FILTER, '2026-04')).toBe(true);
  });

  it('drops txs from other months when period=current', () => {
    expect(matchesFilter(t, EMPTY_FILTER, '2026-05')).toBe(false);
  });

  it('keeps only prev-month txs when period=last', () => {
    const filter: LedgerFilterState = { ...EMPTY_FILTER, period: 'last' };
    expect(matchesFilter(t, filter, '2026-05')).toBe(true);
    expect(matchesFilter(t, filter, '2026-04')).toBe(false);
  });

  it('filters by kind when kinds list is non-empty', () => {
    const filter: LedgerFilterState = { ...EMPTY_FILTER, kinds: ['income'] };
    expect(matchesFilter(t, filter, '2026-04')).toBe(false);
    expect(matchesFilter({ ...t, kind: 'income' }, filter, '2026-04')).toBe(true);
  });

  it('filters by category id set', () => {
    const filter: LedgerFilterState = { ...EMPTY_FILTER, categoryIds: [1, 2] };
    expect(matchesFilter(t, filter, '2026-04')).toBe(false);
    expect(matchesFilter({ ...t, categoryId: 2 }, filter, '2026-04')).toBe(true);
  });

  it('filters by min/max amount bounds (inclusive)', () => {
    const within: LedgerFilterState = { ...EMPTY_FILTER, minAmount: 10, maxAmount: 100 };
    expect(matchesFilter(t, within, '2026-04')).toBe(true);
    expect(matchesFilter({ ...t, amount: 5 }, within, '2026-04')).toBe(false);
    expect(matchesFilter({ ...t, amount: 101 }, within, '2026-04')).toBe(false);
  });

  it('combines all dimensions (AND logic)', () => {
    const filter: LedgerFilterState = {
      period: 'all',
      kinds: ['expense'],
      categoryIds: [3],
      minAmount: 40,
      maxAmount: 60,
    };
    expect(matchesFilter(t, filter, '2026-04')).toBe(true);
    expect(matchesFilter({ ...t, categoryId: 4 }, filter, '2026-04')).toBe(false);
  });
});

describe('activeFilterCount', () => {
  it('returns 0 for the empty filter and counts each non-default dimension', () => {
    expect(activeFilterCount(EMPTY_FILTER)).toBe(0);
    expect(
      activeFilterCount({
        period: 'all',
        kinds: ['expense'],
        categoryIds: [1, 2],
        minAmount: 10,
        maxAmount: 50,
      }),
    ).toBe(5);
  });
});
