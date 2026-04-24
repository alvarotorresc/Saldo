import type { Goal, Loan } from '@/types';

export interface NetWorthBreakdown {
  assets: number;
  liabilities: number;
  netWorth: number;
  cashBalance: number;
  savedGoals: number;
  loansOutstanding: number;
}

/**
 * Pure: aggregates a single-account net worth from cash balance, total saved
 * across goals and outstanding loans (principal × fraction of remaining
 * months, fallback to full principal when schedule is unknown).
 */
export function netWorth(
  cashBalance: number,
  goals: readonly Pick<Goal, 'saved'>[],
  loans: readonly Pick<Loan, 'principal' | 'termMonths' | 'startDate'>[],
  now = new Date(),
): NetWorthBreakdown {
  const savedGoals = goals.reduce((s, g) => s + Math.max(0, g.saved), 0);

  let loansOutstanding = 0;
  for (const l of loans) {
    if (!l.termMonths || !l.startDate) {
      loansOutstanding += Math.max(0, l.principal);
      continue;
    }
    const [y, m, d] = l.startDate.split('-').map(Number);
    if (!y || !m) {
      loansOutstanding += Math.max(0, l.principal);
      continue;
    }
    const start = new Date(y, m - 1, d ?? 1);
    const monthsIn =
      (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    const remaining = Math.max(0, l.termMonths - monthsIn);
    loansOutstanding += (remaining / l.termMonths) * l.principal;
  }

  const assets = cashBalance + savedGoals;
  const liabilities = loansOutstanding;
  return {
    assets,
    liabilities,
    netWorth: assets - liabilities,
    cashBalance,
    savedGoals,
    loansOutstanding,
  };
}
