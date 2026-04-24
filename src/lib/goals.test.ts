import { describe, it, expect } from 'vitest';
import { goalProgress } from './goals';

describe('goalProgress', () => {
  it('pct, remaining and monthlyNeeded for a live goal with deadline', () => {
    const now = new Date(2026, 3, 1); // Apr 2026
    const p = goalProgress({ target: 1200, saved: 300, deadline: '2026-12-01' }, now);
    expect(p.pct).toBeCloseTo(0.25);
    expect(p.remaining).toBe(900);
    expect(p.monthsLeft).toBe(8);
    expect(p.monthlyNeeded).toBeCloseTo(900 / 8, 5);
  });

  it('clamps monthsLeft to >= 1 when deadline is this month or past', () => {
    const now = new Date(2026, 3, 20);
    const p = goalProgress({ target: 1000, saved: 100, deadline: '2026-04-30' }, now);
    expect(p.monthsLeft).toBe(1);
    expect(p.monthlyNeeded).toBe(900);
  });

  it('returns zero monthlyNeeded when the goal is already completed', () => {
    const p = goalProgress(
      { target: 500, saved: 600, deadline: '2026-12-01' },
      new Date(2026, 3, 1),
    );
    expect(p.pct).toBe(1);
    expect(p.remaining).toBe(0);
    expect(p.monthlyNeeded).toBe(0);
  });

  it('handles goals with no deadline (monthsLeft null, monthlyNeeded 0)', () => {
    const p = goalProgress({ target: 1000, saved: 100 }, new Date(2026, 3, 1));
    expect(p.monthsLeft).toBeNull();
    expect(p.monthlyNeeded).toBe(0);
  });
});
