import { create } from 'zustand';
import type { Transaction, TxKind } from '@/types';

export type PeriodKey = 'current' | 'last' | 'all';

export interface LedgerFilterState {
  period: PeriodKey;
  kinds: readonly TxKind[]; // empty = all
  categoryIds: readonly number[]; // empty = all
  minAmount: number | null;
  maxAmount: number | null;
}

export const EMPTY_FILTER: LedgerFilterState = {
  period: 'current',
  kinds: [],
  categoryIds: [],
  minAmount: null,
  maxAmount: null,
};

interface Store extends LedgerFilterState {
  set: (patch: Partial<LedgerFilterState>) => void;
  reset: () => void;
}

export const useLedgerFilter = create<Store>((set) => ({
  ...EMPTY_FILTER,
  set: (patch) => set(patch),
  reset: () => set(EMPTY_FILTER),
}));

/**
 * Pure: returns true when every active filter accepts the transaction.
 * Empty arrays mean "no filter on this dimension".
 */
export function matchesFilter(
  tx: Transaction,
  filter: LedgerFilterState,
  currentMonth: string,
): boolean {
  if (filter.kinds.length > 0 && !filter.kinds.includes(tx.kind)) return false;
  if (filter.categoryIds.length > 0) {
    if (typeof tx.categoryId !== 'number') return false;
    if (!filter.categoryIds.includes(tx.categoryId)) return false;
  }
  if (filter.minAmount != null && tx.amount < filter.minAmount) return false;
  if (filter.maxAmount != null && tx.amount > filter.maxAmount) return false;

  if (filter.period === 'current') {
    if (tx.month !== currentMonth) return false;
  } else if (filter.period === 'last') {
    if (tx.month !== shiftMonth(currentMonth, -1)) return false;
  }
  // 'all' → no month restriction.
  return true;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Pure: number of active filter dimensions (for the APPLY(N) CTA). */
export function activeFilterCount(filter: LedgerFilterState): number {
  let n = 0;
  if (filter.period !== 'current') n++;
  if (filter.kinds.length > 0) n++;
  if (filter.categoryIds.length > 0) n++;
  if (filter.minAmount != null) n++;
  if (filter.maxAmount != null) n++;
  return n;
}
