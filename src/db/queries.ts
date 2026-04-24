import { db } from './database';
import type { Transaction } from '@/types';

export async function txByMonth(month: string): Promise<Transaction[]> {
  return db.transactions
    .where('month')
    .equals(month)
    .sortBy('date')
    .then((r) => r.reverse());
}

export async function txByRange(fromMonth: string, toMonth: string): Promise<Transaction[]> {
  return db.transactions.where('month').between(fromMonth, toMonth, true, true).toArray();
}

export function effectiveAmount(t: Transaction): number {
  if (t.kind === 'expense') return t.personalAmount ?? t.amount;
  return t.amount;
}

export async function sumByKind(
  month: string,
): Promise<{ income: number; expense: number; net: number }> {
  const rows = await txByMonth(month);
  let income = 0;
  let expense = 0;
  for (const t of rows) {
    if (t.kind === 'income') {
      if (t.reimbursementFor) continue; // reimbursements cancel split portion, not income
      income += t.amount;
    } else if (t.kind === 'expense') {
      expense += effectiveAmount(t);
    }
  }
  return { income, expense, net: income - expense };
}

export async function monthsWithData(): Promise<string[]> {
  const all = await db.transactions.orderBy('month').uniqueKeys();
  return (all as string[]).sort().reverse();
}

export async function expensesByCategory(month: string): Promise<Map<number | 'none', number>> {
  const rows = await db.transactions
    .where('month')
    .equals(month)
    .filter((t) => t.kind === 'expense')
    .toArray();
  const map = new Map<number | 'none', number>();
  for (const t of rows) {
    const k: number | 'none' = t.categoryId ?? 'none';
    map.set(k, (map.get(k) ?? 0) + effectiveAmount(t));
  }
  return map;
}

export async function expensesByGroup(month: string): Promise<Map<number | 'none', number>> {
  const rows = await db.transactions
    .where('month')
    .equals(month)
    .filter((t) => t.kind === 'expense')
    .toArray();
  const cats = await db.categories.toArray();
  const catToGroup = new Map<number, number | undefined>();
  cats.forEach((c) => c.id && catToGroup.set(c.id, c.groupId));
  const map = new Map<number | 'none', number>();
  for (const t of rows) {
    const gid = t.categoryId ? catToGroup.get(t.categoryId) : undefined;
    const key: number | 'none' = gid ?? 'none';
    map.set(key, (map.get(key) ?? 0) + effectiveAmount(t));
  }
  return map;
}

function daysInMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

/**
 * Pure helper: given a set of transactions and a month (yyyy-mm), returns an
 * array whose length matches the number of days in that month. Each index
 * holds the sum of `effectiveAmount` for expenses on that day.
 * Income and reimbursements are ignored.
 */
export function dailySpendFromRows(rows: readonly Transaction[], month: string): number[] {
  const len = daysInMonth(month);
  const out = new Array<number>(len).fill(0);
  for (const t of rows) {
    if (t.kind !== 'expense') continue;
    if (t.month !== month) continue;
    const day = Number(t.date.slice(8, 10));
    if (!day || day < 1 || day > len) continue;
    out[day - 1] += effectiveAmount(t);
  }
  return out;
}

export async function dailySpend(month: string): Promise<number[]> {
  const rows = await txByMonth(month);
  return dailySpendFromRows(rows, month);
}

export async function monthlyTotals(
  months: string[],
): Promise<Map<string, { income: number; expense: number; net: number }>> {
  const result = new Map<string, { income: number; expense: number; net: number }>();
  if (months.length === 0) return result;
  const sorted = [...months].sort();
  const rows = await db.transactions
    .where('month')
    .between(sorted[0], sorted[sorted.length - 1], true, true)
    .toArray();
  for (const m of months) result.set(m, { income: 0, expense: 0, net: 0 });
  for (const t of rows) {
    const acc = result.get(t.month);
    if (!acc) continue;
    if (t.kind === 'income') {
      if (t.reimbursementFor) continue;
      acc.income += t.amount;
    } else if (t.kind === 'expense') {
      acc.expense += effectiveAmount(t);
    }
    acc.net = acc.income - acc.expense;
  }
  return result;
}
