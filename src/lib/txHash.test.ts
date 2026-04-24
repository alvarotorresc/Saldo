import { describe, it, expect } from 'vitest';
import { canonicalTxJson, txHash } from './txHash';
import type { Transaction } from '@/types';

const base: Transaction = {
  id: 1,
  accountId: 1,
  date: '2026-04-24',
  amount: 42,
  kind: 'expense',
  description: 'Supermercado Lidl',
  merchant: 'Lidl',
  categoryId: 1,
  month: '2026-04',
  createdAt: 1_700_000_000_000,
};

describe('txHash', () => {
  it('canonical JSON is order-independent so hashing two structurally equivalent txs collides', async () => {
    const a = base;
    const b: Transaction = { ...base, amount: 42, categoryId: 1 };
    expect(canonicalTxJson(a)).toBe(canonicalTxJson(b));
    expect(await txHash(a)).toBe(await txHash(b));
  });

  it('changes when a stable field changes (amount, date, kind, merchant, categoryId)', async () => {
    const h0 = await txHash(base);
    expect(await txHash({ ...base, amount: 43 })).not.toBe(h0);
    expect(await txHash({ ...base, date: '2026-04-25' })).not.toBe(h0);
    expect(await txHash({ ...base, kind: 'income' })).not.toBe(h0);
    expect(await txHash({ ...base, merchant: 'Mercadona' })).not.toBe(h0);
    expect(await txHash({ ...base, categoryId: 2 })).not.toBe(h0);
  });

  it('ignores volatile fields (id, createdAt, tags, notes)', async () => {
    const h0 = await txHash(base);
    expect(await txHash({ ...base, id: 999 })).toBe(h0);
    expect(await txHash({ ...base, createdAt: 0 })).toBe(h0);
    expect(await txHash({ ...base, tags: ['foo'] })).toBe(h0);
    expect(await txHash({ ...base, notes: 'changed' })).toBe(h0);
  });
});
