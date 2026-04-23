import { describe, expect, it } from 'vitest';
import { filterTx, groupTxByDate, summarize } from './LedgerPage.helpers';
import type { Transaction } from '@/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> & { id: number }): Transaction {
  return {
    accountId: 1,
    date: '2026-04-20',
    month: '2026-04',
    amount: 10,
    kind: 'expense',
    description: 'Test tx',
    createdAt: Date.now(),
    ...overrides,
  };
}

const expense1 = makeTx({
  id: 1,
  description: 'Mercadona compra',
  merchant: 'Mercadona',
  amount: 50,
  kind: 'expense',
  date: '2026-04-20',
});
const expense2 = makeTx({
  id: 2,
  description: 'Glovo delivery',
  merchant: 'Glovo',
  amount: 30,
  kind: 'expense',
  date: '2026-04-19',
  tags: ['comida', 'delivery'],
});
const income1 = makeTx({
  id: 3,
  description: 'Salario',
  merchant: 'Empresa',
  amount: 1500,
  kind: 'income',
  date: '2026-04-01',
});
const transfer1 = makeTx({
  id: 4,
  description: 'Transferencia',
  merchant: 'N26',
  amount: 200,
  kind: 'transfer',
  date: '2026-04-15',
});
const reimbursement = makeTx({
  id: 5,
  description: 'Devolucion Juan',
  amount: 15,
  kind: 'income',
  date: '2026-04-10',
  reimbursementFor: 2,
});
const splitExpense = makeTx({
  id: 6,
  description: 'Cena compartida',
  amount: 80,
  kind: 'expense',
  personalAmount: 20,
  date: '2026-04-18',
});

// ─── filterTx ────────────────────────────────────────────────────────────────

describe('filterTx', () => {
  const all = [expense1, expense2, income1, transfer1];

  it('kindFilter=all returns all transactions', () => {
    expect(filterTx(all, '', 'all')).toHaveLength(4);
  });

  it('kindFilter=expense filters to expenses only', () => {
    const result = filterTx(all, '', 'expense');
    expect(result.every((t) => t.kind === 'expense')).toBe(true);
    expect(result).toHaveLength(2);
  });

  it('kindFilter=income filters to income only', () => {
    const result = filterTx(all, '', 'income');
    expect(result.every((t) => t.kind === 'income')).toBe(true);
    expect(result).toHaveLength(1);
  });

  it('kindFilter=transfer filters to transfers only', () => {
    const result = filterTx(all, '', 'transfer');
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('transfer');
  });

  it('empty query returns all when kindFilter=all', () => {
    expect(filterTx(all, '   ', 'all')).toHaveLength(4);
  });

  it('matches query against description (case-insensitive)', () => {
    const result = filterTx(all, 'MERCADONA', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(1);
  });

  it('matches query against merchant', () => {
    const result = filterTx(all, 'glovo', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('matches query against tags', () => {
    const result = filterTx(all, 'delivery', 'all');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(2);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterTx(all, 'xxxxxxxx', 'all')).toHaveLength(0);
  });

  it('handles undefined tags gracefully', () => {
    const txNoTags = makeTx({ id: 99, description: 'No tags', tags: undefined });
    expect(() => filterTx([txNoTags], 'foo', 'all')).not.toThrow();
  });
});

// ─── groupTxByDate ───────────────────────────────────────────────────────────

describe('groupTxByDate', () => {
  it('single day: groups correctly', () => {
    const groups = groupTxByDate([expense1]);
    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-04-20');
    expect(groups[0].txs).toHaveLength(1);
  });

  it('multiple days: sorts descending', () => {
    const groups = groupTxByDate([expense1, expense2, income1]);
    const dates = groups.map((g) => g.date);
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('preserves tx order within a group', () => {
    const txA = makeTx({ id: 10, description: 'A', date: '2026-04-20', amount: 5 });
    const txB = makeTx({ id: 11, description: 'B', date: '2026-04-20', amount: 8 });
    const groups = groupTxByDate([txA, txB]);
    expect(groups[0].txs[0].id).toBe(10);
    expect(groups[0].txs[1].id).toBe(11);
  });

  it('computes daily total: income positive', () => {
    const groups = groupTxByDate([income1]);
    expect(groups[0].total).toBe(1500);
  });

  it('computes daily total: expense negative (effective amount)', () => {
    const groups = groupTxByDate([splitExpense]); // personalAmount=20 of 80
    expect(groups[0].total).toBe(-20);
  });

  it('transfer contributes 0 to daily total', () => {
    const groups = groupTxByDate([transfer1]);
    expect(groups[0].total).toBe(0);
  });

  it('mixed day: income − effective expense, transfer 0', () => {
    const sameDay = [
      makeTx({ id: 20, description: 'In', kind: 'income', amount: 100, date: '2026-04-05' }),
      makeTx({ id: 21, description: 'Out', kind: 'expense', amount: 40, date: '2026-04-05' }),
      makeTx({ id: 22, description: 'Tr', kind: 'transfer', amount: 50, date: '2026-04-05' }),
    ];
    const groups = groupTxByDate(sameDay);
    expect(groups[0].total).toBe(60); // 100 - 40
  });

  it('empty input returns empty array', () => {
    expect(groupTxByDate([])).toHaveLength(0);
  });
});

// ─── summarize ───────────────────────────────────────────────────────────────

describe('summarize', () => {
  it('happy path: count, income, expense, delta', () => {
    const result = summarize([expense1, income1]);
    expect(result.count).toBe(2);
    expect(result.income).toBe(1500);
    expect(result.expense).toBe(50);
    expect(result.delta).toBe(1450);
  });

  it('reimbursements excluded from income total', () => {
    const result = summarize([income1, reimbursement]);
    expect(result.count).toBe(2);
    expect(result.income).toBe(1500); // reimbursement excluded
  });

  it('expense uses effective amount (personalAmount)', () => {
    const result = summarize([splitExpense]); // personalAmount=20 of 80
    expect(result.expense).toBe(20);
  });

  it('transfer excluded from both income and expense', () => {
    const result = summarize([transfer1]);
    expect(result.count).toBe(1);
    expect(result.income).toBe(0);
    expect(result.expense).toBe(0);
    expect(result.delta).toBe(0);
  });

  it('empty input returns zeros', () => {
    const result = summarize([]);
    expect(result).toEqual({ count: 0, income: 0, expense: 0, delta: 0 });
  });

  it('only expenses: delta is negative', () => {
    const result = summarize([expense1, expense2]);
    expect(result.income).toBe(0);
    expect(result.expense).toBe(80); // 50 + 30
    expect(result.delta).toBe(-80);
  });
});
