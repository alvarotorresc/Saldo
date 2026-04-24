import { describe, it, expect } from 'vitest';
import { fuzzyScore, fuzzyRank } from './fuzzy';

describe('fuzzyScore', () => {
  it('returns 0 on empty query and negative when the query cannot be matched in order', () => {
    expect(fuzzyScore('', 'anything')).toBe(0);
    expect(fuzzyScore('xyz', 'ledger')).toBeLessThan(0);
  });

  it('scores contiguous matches higher than scattered ones', () => {
    const contiguous = fuzzyScore('led', 'ledger');
    const scattered = fuzzyScore('led', 'long-extended-d');
    expect(contiguous).toBeGreaterThan(scattered);
  });

  it('is case-insensitive', () => {
    expect(fuzzyScore('LED', 'ledger')).toBeGreaterThan(0);
  });
});

describe('fuzzyRank', () => {
  const items = [
    { item: 'new expense', haystack: 'new expense' },
    { item: 'new income', haystack: 'new income' },
    { item: 'import CSV', haystack: 'import csv' },
    { item: 'export .saldo', haystack: 'export saldo' },
  ];

  it('returns everything unchanged when the query is empty', () => {
    expect(fuzzyRank('', items)).toEqual(items.map((i) => i.item));
  });

  it('surfaces the best match first and drops non-matches', () => {
    const out = fuzzyRank('imp', items);
    expect(out[0]).toBe('import CSV');
    // 'new expense' / 'new income' do not contain i..m..p in order.
    expect(out).not.toContain('new income');
  });
});
