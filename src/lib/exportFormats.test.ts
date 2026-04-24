import { describe, it, expect } from 'vitest';
import { escapeCsvField, transactionsToCsv, transactionsToOfx } from './exportFormats';
import type { Category, Transaction } from '@/types';

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'date' | 'amount' | 'kind'>,
): Transaction {
  return {
    accountId: 1,
    description: 'x',
    createdAt: 0,
    month: partial.date.slice(0, 7),
    ...partial,
  } as Transaction;
}

const cats = new Map<number, Pick<Category, 'name'>>([
  [1, { name: 'Supermercado' }],
  [2, { name: 'Nómina' }],
]);

describe('escapeCsvField', () => {
  it('passes simple values through unquoted', () => {
    expect(escapeCsvField('Mercadona')).toBe('Mercadona');
  });
  it('quotes values containing comma, quote, newline or CR', () => {
    expect(escapeCsvField('Hi, you')).toBe('"Hi, you"');
    expect(escapeCsvField('she said "ok"')).toBe('"she said ""ok"""');
    expect(escapeCsvField('a\nb')).toBe('"a\nb"');
  });
});

describe('transactionsToCsv', () => {
  it('emits a header + rows with signed amount and escaped description', () => {
    const rows = [
      tx({
        date: '2026-04-01',
        amount: 12,
        kind: 'expense',
        description: 'Lidl, centro',
        categoryId: 1,
      }),
      tx({
        date: '2026-04-02',
        amount: 2000,
        kind: 'income',
        description: 'Nómina',
        categoryId: 2,
      }),
    ];
    const csv = transactionsToCsv(rows, cats);
    const lines = csv.split('\r\n');
    expect(lines[0]).toBe('date,kind,amount,description,merchant,category,notes');
    expect(lines[1]).toBe('2026-04-01,expense,-12.00,"Lidl, centro",,Supermercado,');
    expect(lines[2]).toBe('2026-04-02,income,2000.00,Nómina,,Nómina,');
  });
});

describe('transactionsToOfx', () => {
  const rows = [
    tx({
      date: '2026-04-01',
      amount: 15.5,
      kind: 'expense',
      description: 'Lidl',
      merchant: 'Lidl',
    }),
    tx({
      date: '2026-04-02',
      amount: 2000,
      kind: 'income',
      description: 'Nomina',
      merchant: 'ACME',
    }),
    tx({ date: '2026-04-03', amount: 5, kind: 'transfer', description: 'skipped' }),
  ];
  const ofx = transactionsToOfx(rows, { bankId: 'SALDO', acctId: 'LOCAL' });

  it('opens with the OFX SGML header and wraps content in <OFX>', () => {
    expect(ofx).toMatch(/^OFXHEADER:100/);
    expect(ofx).toContain('<OFX>');
    expect(ofx).toContain('</OFX>');
  });

  it('emits a STMTTRN for each non-transfer and skips transfers', () => {
    const stmts = (ofx.match(/<STMTTRN>/g) ?? []).length;
    expect(stmts).toBe(2);
    expect(ofx).toContain('<TRNAMT>-15.50');
    expect(ofx).toContain('<TRNAMT>2000.00');
    expect(ofx).not.toContain('skipped');
  });

  it('declares currency and the running ledger balance', () => {
    expect(ofx).toContain('<CURDEF>EUR');
    expect(ofx).toContain('<BALAMT>1984.50'); // 2000 - 15.50
  });
});
