import { describe, it, expect } from 'vitest';
import { importConfidence, isWarningRow } from './importConfidence';

describe('importConfidence', () => {
  it('returns 1 when every field is present and plausible', () => {
    expect(
      importConfidence({
        date: '2026-04-24',
        amount: 12.5,
        description: 'Supermercado Mercadona',
        merchant: 'Mercadona',
        kind: 'expense',
      }),
    ).toBe(1);
  });

  it('penalises missing or invalid date the most', () => {
    const score = importConfidence({
      amount: 10,
      description: 'ok',
      merchant: 'merchant',
      kind: 'expense',
    });
    expect(score).toBeCloseTo(0.6, 5);
  });

  it('flags rows under 0.8 as warnings', () => {
    expect(
      isWarningRow({ date: '2026-04-01', amount: 10, description: 'x', kind: 'expense' }),
    ).toBe(true); // missing merchant + short description penalty
    expect(
      isWarningRow({
        date: '2026-04-01',
        amount: 10,
        description: 'Mercadona',
        merchant: 'Mercadona',
        kind: 'expense',
      }),
    ).toBe(false);
  });

  it('clamps to 0 when everything is wrong', () => {
    expect(importConfidence({})).toBe(0);
  });

  it('penalises non-finite or negative amount', () => {
    const a = importConfidence({
      date: '2026-04-01',
      description: 'x',
      merchant: 'y',
      kind: 'expense',
      amount: -5,
    });
    const b = importConfidence({
      date: '2026-04-01',
      description: 'x',
      merchant: 'y',
      kind: 'expense',
      amount: 5,
    });
    expect(b).toBeGreaterThan(a);
  });

  it('keeps scores in [0,1] regardless of input', () => {
    expect(importConfidence({ date: 'bad', amount: NaN, description: '' })).toBeGreaterThanOrEqual(
      0,
    );
    expect(importConfidence({ date: 'bad', amount: NaN, description: '' })).toBeLessThanOrEqual(1);
  });
});
