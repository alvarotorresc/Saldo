import { describe, it, expect } from 'vitest';
import { netWorth } from './netWorth';

describe('netWorth', () => {
  it('sums cash + saved goals minus outstanding loans', () => {
    const now = new Date(2026, 3, 1);
    const nw = netWorth(
      5000,
      [{ saved: 1200 }, { saved: 800 }],
      [{ principal: 12000, termMonths: 120, startDate: '2025-04-01' }],
      now,
    );
    // 12 months elapsed of a 120-month loan → 108/120 * 12000 = 10800 outstanding
    expect(nw.cashBalance).toBe(5000);
    expect(nw.savedGoals).toBe(2000);
    expect(nw.loansOutstanding).toBeCloseTo(10800, 3);
    expect(nw.assets).toBe(7000);
    expect(nw.liabilities).toBeCloseTo(10800, 3);
    expect(nw.netWorth).toBeCloseTo(-3800, 3);
  });

  it('returns 0 liabilities when loans array is empty', () => {
    const nw = netWorth(500, [{ saved: 100 }], [], new Date(2026, 3, 1));
    expect(nw.liabilities).toBe(0);
    expect(nw.netWorth).toBe(600);
  });

  it('falls back to full principal when a loan has no termMonths', () => {
    const nw = netWorth(
      0,
      [],
      [{ principal: 1000, termMonths: 0, startDate: '2025-01-01' }],
      new Date(2026, 3, 1),
    );
    expect(nw.liabilities).toBe(1000);
    expect(nw.netWorth).toBe(-1000);
  });
});
