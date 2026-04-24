import { describe, it, expect } from 'vitest';
import { parseAmountInput, validateDraft, draftToTransaction, type NewTxDraft } from './newTx';

const validDraft: NewTxDraft = {
  kind: 'expense',
  amount: 12.34,
  date: '2026-04-24',
  description: 'Supermercado',
  accountId: 1,
};

describe('parseAmountInput', () => {
  it('accepts dot and comma as decimal separators and trims whitespace', () => {
    expect(parseAmountInput(' 12.34 ')).toBe(12.34);
    expect(parseAmountInput('12,34')).toBe(12.34);
  });

  it('rounds to two decimals and handles thousands separators', () => {
    expect(parseAmountInput('1.234,567')).toBe(1234.57);
    expect(parseAmountInput('1,000.00')).toBe(1000);
  });

  it('returns NaN on empty or non-numeric input', () => {
    expect(Number.isNaN(parseAmountInput(''))).toBe(true);
    expect(Number.isNaN(parseAmountInput('abc'))).toBe(true);
  });
});

describe('validateDraft', () => {
  it('returns no errors for a valid draft', () => {
    expect(validateDraft(validDraft)).toEqual([]);
  });

  it('flags amount<=0 and malformed date', () => {
    const errors = validateDraft({ ...validDraft, amount: 0, date: 'bad' });
    expect(errors.map((e) => e.field).sort()).toEqual(['amount', 'date']);
  });

  it('flags personalAmount out of range', () => {
    const errors = validateDraft({ ...validDraft, personalAmount: 100 });
    expect(errors.some((e) => e.field === 'personalAmount')).toBe(true);
  });
});

describe('draftToTransaction', () => {
  it('derives month from date and strips undefined merchants', () => {
    const out = draftToTransaction({ ...validDraft, merchant: '  ' });
    expect(out.month).toBe('2026-04');
    expect(out.merchant).toBeUndefined();
  });
});
