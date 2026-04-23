import { effectiveAmount } from '@/db/queries';
import type { Transaction } from '@/types';

export type LedgerKindFilter = 'all' | 'income' | 'expense' | 'transfer';

/**
 * Filter transactions by kind and/or search query.
 * Query matches against description, merchant, and tags (case-insensitive).
 */
export function filterTx(
  txs: readonly Transaction[],
  query: string,
  kindFilter: LedgerKindFilter,
): Transaction[] {
  const q = query.trim().toLowerCase();
  return txs.filter((t) => {
    if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
    if (!q) return true;
    return (
      t.description.toLowerCase().includes(q) ||
      (t.merchant ?? '').toLowerCase().includes(q) ||
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
    );
  });
}

export interface DateGroup {
  date: string; // yyyy-mm-dd
  total: number; // net of day: income positive, expense negative (effective), transfer 0
  txs: Transaction[];
}

/**
 * Group transactions by date, sorted descending (most recent first).
 * Preserves tx order within each group.
 */
export function groupTxByDate(txs: readonly Transaction[]): DateGroup[] {
  const map = new Map<string, Transaction[]>();
  for (const t of txs) {
    const arr = map.get(t.date) ?? [];
    arr.push(t);
    map.set(t.date, arr);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0)) // descending by date string
    .map(([date, group]) => {
      const total = group.reduce((sum, t) => {
        if (t.kind === 'income') return sum + t.amount;
        if (t.kind === 'expense') return sum - effectiveAmount(t);
        return sum; // transfer = 0
      }, 0);
      return { date, total, txs: group };
    });
}

export interface LedgerSummary {
  count: number;
  income: number; // sum of income amounts (excluding reimbursements)
  expense: number; // sum of effective expense amounts
  delta: number; // income - expense
}

/**
 * Summarize a set of transactions.
 * Reimbursements (kind='income' && reimbursementFor != null) are excluded from income total.
 */
export function summarize(txs: readonly Transaction[]): LedgerSummary {
  let income = 0;
  let expense = 0;
  for (const t of txs) {
    if (t.kind === 'income') {
      if (t.reimbursementFor != null) continue; // exclude reimbursements
      income += t.amount;
    } else if (t.kind === 'expense') {
      expense += effectiveAmount(t);
    }
    // transfer: excluded from both income and expense
  }
  return { count: txs.length, income, expense, delta: income - expense };
}
