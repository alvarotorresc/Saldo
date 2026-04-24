import { describe, it, expect } from 'vitest';
import { budgetStats } from './budgets';

describe('budgetStats', () => {
  it('computes pct, remaining, dailyAvg and projected for a past month (uses full month)', () => {
    const now = new Date(2026, 4, 20); // May 20th — the queried month is already closed.
    const s = budgetStats(150, 200, '2026-04', now);
    expect(s.daysInMonth).toBe(30);
    expect(s.dayOfMonth).toBe(30); // treated as end-of-month
    expect(s.pct).toBeCloseTo(0.75);
    expect(s.remaining).toBe(50);
    expect(s.over).toBe(false);
    expect(s.dailyAvg).toBeCloseTo(5, 5);
    expect(s.projected).toBeCloseTo(150, 5);
  });

  it('computes dayOfMonth against today when the budget month is the current month', () => {
    const now = new Date(2026, 3, 10); // April 10th
    const s = budgetStats(100, 300, '2026-04', now);
    expect(s.dayOfMonth).toBe(10);
    expect(s.dailyAvg).toBeCloseTo(10, 5);
    expect(s.projected).toBeCloseTo(300, 5);
  });

  it('flags over when spent exceeds limit', () => {
    const s = budgetStats(250, 200, '2026-04', new Date(2026, 3, 30));
    expect(s.over).toBe(true);
    expect(s.remaining).toBe(0);
    expect(s.pct).toBeGreaterThan(1);
  });

  it('handles limit=0 safely (pct 0, remaining 0)', () => {
    const s = budgetStats(50, 0, '2026-04', new Date(2026, 3, 15));
    expect(s.pct).toBe(0);
    expect(s.remaining).toBe(0);
    expect(s.over).toBe(true);
  });

  it('handles a short month (Feb 28) correctly', () => {
    const s = budgetStats(0, 100, '2026-02', new Date(2026, 1, 14));
    expect(s.daysInMonth).toBe(28);
    expect(s.dayOfMonth).toBe(14);
  });
});
