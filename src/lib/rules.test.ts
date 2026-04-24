import { describe, it, expect } from 'vitest';
import { matchRule, previewMatches, reapplyPlan } from './rules';
import type { Rule, Transaction } from '@/types';

const rules: Rule[] = [
  { id: 1, pattern: 'mercadona', categoryId: 10, priority: 10 },
  { id: 2, pattern: 'netflix', categoryId: 20, priority: 10, enabled: 1 },
  { id: 3, pattern: 'netflix', categoryId: 99, priority: 5, enabled: 0 }, // disabled: must never win
  { id: 4, pattern: 'spotify', categoryId: 30, priority: 1 },
  { id: 5, pattern: 'amazon', categoryId: 40, priority: 9 },
];

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'amount' | 'kind' | 'date'>,
): Transaction {
  return {
    accountId: 1,
    description: 'x',
    merchant: 'x',
    createdAt: 0,
    month: partial.date.slice(0, 7),
    ...partial,
  } as Transaction;
}

describe('matchRule', () => {
  it('returns undefined when no rule matches', () => {
    expect(matchRule(rules, 'alcampo super')).toBeUndefined();
  });

  it('returns the enabled rule matching the haystack (case-insensitive substring)', () => {
    expect(matchRule(rules, 'mercadona calle mayor')?.id).toBe(1);
    expect(matchRule(rules, 'netflix.com billing')?.id).toBe(2);
  });

  it('skips rules with enabled === 0 even if they would otherwise match', () => {
    // rule id=3 is the only one that could map netflix to category 99 but is disabled.
    const r = matchRule(rules, 'netflix.com');
    expect(r?.id).toBe(2);
    expect(r?.categoryId).toBe(20);
  });

  it('prefers higher priority when multiple rules match the same haystack', () => {
    const hay = 'netflix y spotify premium';
    expect(matchRule(rules, hay)?.id).toBe(2);
  });

  it('treats `enabled === undefined` as enabled (back-compat with pre-v5 DBs)', () => {
    const legacy: Rule[] = [{ id: 9, pattern: 'lidl', categoryId: 1, priority: 1 }];
    expect(matchRule(legacy, 'lidl barrio')?.id).toBe(9);
  });
});

describe('previewMatches', () => {
  const txs: Transaction[] = [
    tx({ date: '2026-04-01', amount: 10, kind: 'expense', merchant: 'Netflix' }),
    tx({ date: '2026-04-02', amount: 12, kind: 'expense', merchant: 'mercadona centro' }),
    tx({ date: '2026-04-03', amount: 7, kind: 'expense', merchant: 'Spotify', description: 's' }),
    tx({ date: '2026-04-04', amount: 500, kind: 'income', description: 'nómina mensual' }),
    tx({ date: '2026-04-05', amount: 5, kind: 'transfer', merchant: 'netflix' }),
  ];

  it('counts matches across merchant+description ignoring transfers', () => {
    expect(previewMatches({ pattern: 'netflix' }, txs)).toBe(1);
    expect(previewMatches({ pattern: 'spotify' }, txs)).toBe(1);
    expect(previewMatches({ pattern: 'mercadona' }, txs)).toBe(1);
  });

  it('returns 0 for empty pattern', () => {
    expect(previewMatches({ pattern: '' }, txs)).toBe(0);
  });

  it('returns 0 when nothing matches', () => {
    expect(previewMatches({ pattern: 'alcampo' }, txs)).toBe(0);
  });
});

describe('reapplyPlan', () => {
  const rulesLocal: Rule[] = [
    { id: 1, pattern: 'mercadona', categoryId: 10, priority: 10 },
    { id: 2, pattern: 'netflix', categoryId: 20, priority: 10, enabled: 0 },
  ];

  it('plans updates only for txs whose current categoryId differs from the matched rule', () => {
    const txs: Transaction[] = [
      tx({
        date: '2026-04-01',
        amount: 10,
        kind: 'expense',
        merchant: 'Mercadona',
        categoryId: 99,
      }),
      tx({
        date: '2026-04-02',
        amount: 10,
        kind: 'expense',
        merchant: 'Mercadona',
        categoryId: 10,
      }),
      tx({ date: '2026-04-03', amount: 10, kind: 'expense', merchant: 'Lidl', categoryId: 5 }),
    ];
    txs[0].id = 1;
    txs[1].id = 2;
    txs[2].id = 3;
    const plan = reapplyPlan(txs, rulesLocal);
    expect(plan.updated).toBe(1);
    expect(plan.changed.get(1)).toBe(10);
    expect(plan.changed.has(2)).toBe(false);
    expect(plan.changed.has(3)).toBe(false);
  });

  it('does not match disabled rules and leaves their txs untouched', () => {
    const txs: Transaction[] = [
      tx({ date: '2026-04-01', amount: 10, kind: 'expense', merchant: 'Netflix', categoryId: 5 }),
    ];
    txs[0].id = 42;
    const plan = reapplyPlan(txs, rulesLocal);
    expect(plan.updated).toBe(0);
  });

  it('skips transfers', () => {
    const txs: Transaction[] = [
      tx({
        date: '2026-04-01',
        amount: 10,
        kind: 'transfer',
        merchant: 'Mercadona',
        categoryId: 0,
      }),
    ];
    txs[0].id = 7;
    const plan = reapplyPlan(txs, rulesLocal);
    expect(plan.updated).toBe(0);
  });
});
