import type { Transaction } from '@/types';
import { effectiveAmount } from '@/db/queries';

export interface MerchantAgg {
  merchant: string;
  total: number;
  count: number;
}

export interface CategoryYoy {
  categoryId: number;
  current: number;
  prev: number;
  deltaPct: number; // +/-, 1 = +100%
}

/** Pure: top N merchants by absolute expense total within the rows. */
export function topMerchants(rows: readonly Transaction[], limit = 10): MerchantAgg[] {
  const map = new Map<string, MerchantAgg>();
  for (const t of rows) {
    if (t.kind !== 'expense') continue;
    const key = (t.merchant ?? t.description).trim();
    if (!key) continue;
    const cur = map.get(key) ?? { merchant: key, total: 0, count: 0 };
    cur.total += effectiveAmount(t);
    cur.count += 1;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.total - a.total).slice(0, limit);
}

/**
 * Pure: year-over-year totals per category between two month sets (current
 * year vs previous year). Returns only categories present in either set.
 */
export function categoryYoy(
  current: readonly Transaction[],
  prev: readonly Transaction[],
): CategoryYoy[] {
  const agg = (rows: readonly Transaction[]): Map<number, number> => {
    const m = new Map<number, number>();
    for (const t of rows) {
      if (t.kind !== 'expense' || typeof t.categoryId !== 'number') continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + effectiveAmount(t));
    }
    return m;
  };
  const c = agg(current);
  const p = agg(prev);
  const ids = new Set<number>([...c.keys(), ...p.keys()]);
  const out: CategoryYoy[] = [];
  for (const id of ids) {
    const cur = c.get(id) ?? 0;
    const prv = p.get(id) ?? 0;
    const deltaPct = prv > 0 ? (cur - prv) / prv : cur > 0 ? 1 : 0;
    out.push({ categoryId: id, current: cur, prev: prv, deltaPct });
  }
  return out.sort((a, b) => b.current - a.current);
}

/** Pure: cumulative net worth series (running net) for a chronological row array. */
export function runningNetSeries(rows: readonly Transaction[]): number[] {
  let acc = 0;
  const out: number[] = [];
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  for (const t of sorted) {
    if (t.kind === 'income') acc += t.amount;
    else if (t.kind === 'expense') acc -= effectiveAmount(t);
    out.push(acc);
  }
  return out;
}
