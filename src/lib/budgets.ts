export interface BudgetStats {
  spent: number;
  limit: number;
  pct: number; // 0..1+ (allows >1 for over)
  over: boolean;
  remaining: number;
  dailyAvg: number;
  projected: number;
  daysInMonth: number;
  dayOfMonth: number;
}

function daysInMonth(monthIso: string): number {
  const [y, m] = monthIso.split('-').map(Number);
  if (!y || !m) return 30;
  return new Date(y, m, 0).getDate();
}

function dayOfMonth(monthIso: string, now = new Date()): number {
  const [y, m] = monthIso.split('-').map(Number);
  if (!y || !m) return 1;
  if (y !== now.getFullYear() || m !== now.getMonth() + 1) return daysInMonth(monthIso);
  return now.getDate();
}

/**
 * Pure: given a spent amount, budget limit and active month, returns the
 * canonical stats used by BudgetsPage (pct, over, projected end-of-month…).
 */
export function budgetStats(
  spent: number,
  limit: number,
  monthIso: string,
  now = new Date(),
): BudgetStats {
  const total = daysInMonth(monthIso);
  const day = dayOfMonth(monthIso, now);
  const pct = limit > 0 ? spent / limit : 0;
  const over = spent > limit;
  const dailyAvg = day > 0 ? spent / day : 0;
  const projected = dailyAvg * total;
  return {
    spent,
    limit,
    pct,
    over,
    remaining: Math.max(0, limit - spent),
    dailyAvg,
    projected,
    daysInMonth: total,
    dayOfMonth: day,
  };
}
