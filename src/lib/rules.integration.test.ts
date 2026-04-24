import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { resetDb } from '@/test/resetDb';
import { incrementRuleHit, reapplyMonth } from './rules';

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

async function seedRule(
  pattern: string,
  categoryId: number,
  opts: Partial<{ priority: number; enabled: 0 | 1 }> = {},
) {
  return db.rules.add({
    pattern,
    categoryId,
    priority: opts.priority ?? 10,
    enabled: opts.enabled ?? 1,
    hits: 0,
  });
}

async function seedTx(
  month: string,
  description: string,
  categoryId?: number,
  kind: 'expense' | 'income' | 'transfer' = 'expense',
) {
  return db.transactions.add({
    accountId: 1,
    date: `${month}-10`,
    amount: 5,
    kind,
    description,
    month,
    categoryId,
    createdAt: 0,
  });
}

describe('reapplyMonth', () => {
  it('should return 0 when no rule matches any tx in the month', async () => {
    // Arrange
    await seedRule('mercadona', 10);
    await seedTx('2026-01', 'unrelated payment');

    // Act
    const result = await reapplyMonth('2026-01');

    // Assert
    expect(result).toBe(0);
  });

  it('should update only txs whose current categoryId differs from matched rule categoryId', async () => {
    // Arrange
    const ruleId = await seedRule('mercadona', 99);
    await seedTx('2026-01', 'mercadona compra', 99); // already correct — should NOT change
    await seedTx('2026-01', 'mercadona supermercado', 1); // wrong category — should change
    await seedTx('2026-01', 'mercadona express', 2); // wrong category — should change

    // Act
    const result = await reapplyMonth('2026-01');

    // Assert
    expect(result).toBe(2);
    const rule = await db.rules.get(ruleId);
    expect(rule?.hits).toBe(2);
  });

  it('should bump rules.hits by the number of txs it changed', async () => {
    // Arrange
    const ruleId = await seedRule('netflix', 50);
    await seedTx('2026-02', 'netflix subscription', 1);
    await seedTx('2026-02', 'netflix annual plan', 2);

    // Act
    await reapplyMonth('2026-02');

    // Assert
    const rule = await db.rules.get(ruleId);
    expect(rule?.hits).toBe(2);
  });

  it('should set lastHitAt on every rule that fired', async () => {
    // Arrange
    const ruleId = await seedRule('spotify', 50);
    await seedTx('2026-02', 'spotify premium', 1);

    // Act
    await reapplyMonth('2026-02');

    // Assert
    const rule = await db.rules.get(ruleId);
    expect(typeof rule?.lastHitAt).toBe('number');
    expect(rule?.lastHitAt).toBeGreaterThan(0);
  });

  it('should ignore transfers', async () => {
    // Arrange
    const ruleId = await seedRule('transferencia', 99);
    await seedTx('2026-03', 'transferencia bancaria', 1, 'transfer');

    // Act
    const result = await reapplyMonth('2026-03');

    // Assert
    expect(result).toBe(0);
    const rule = await db.rules.get(ruleId);
    expect(rule?.hits).toBe(0);
  });

  it('should skip disabled rules even if they would match a tx', async () => {
    // Arrange — only a disabled rule matches; no enabled rule present
    const ruleId = await seedRule('mercadona', 99, { enabled: 0 });
    await seedTx('2026-04', 'mercadona compra', 1);

    // Act
    const result = await reapplyMonth('2026-04');

    // Assert
    expect(result).toBe(0);
    const rule = await db.rules.get(ruleId);
    expect(rule?.hits).toBe(0);
  });

  it('should be scoped to the given month', async () => {
    // Arrange
    const ruleId = await seedRule('glovo', 50);
    await seedTx('2026-05', 'glovo order', 1); // target month
    await seedTx('2026-06', 'glovo order', 1); // different month — must not be touched

    // Act
    const result = await reapplyMonth('2026-05');

    // Assert
    expect(result).toBe(1);
    // tx in 2026-06 keeps its original categoryId
    const otherMonthTxs = await db.transactions.where('month').equals('2026-06').toArray();
    expect(otherMonthTxs[0].categoryId).toBe(1);
    // hits count only reflects matches within the target month
    const rule = await db.rules.get(ruleId);
    expect(rule?.hits).toBe(1);
  });

  it('should return the exact count of updated txs', async () => {
    // Arrange
    await seedRule('uber', 30);
    await seedTx('2026-07', 'uber eats delivery', 1);
    await seedTx('2026-07', 'uber ride home', 2);
    await seedTx('2026-07', 'uber trip', 3);

    // Act
    const result = await reapplyMonth('2026-07');

    // Assert
    expect(result).toBe(3);
  });

  it('should be a no-op when ruleId does not exist', async () => {
    // Arrange — nothing in DB

    // Act + Assert: must not throw, must not create rows
    await expect(incrementRuleHit(9999)).resolves.toBeUndefined();
    const count = await db.rules.count();
    expect(count).toBe(0);
  });

  it('should initialise hits=1 when previous hits is undefined and increment afterwards; lastHitAt updates to the provided timestamp', async () => {
    // Arrange
    const ruleId = await db.rules.add({
      pattern: 'test',
      categoryId: 10,
      priority: 5,
      enabled: 1,
      // hits intentionally omitted to simulate back-compat rule
    });

    // Act — first hit with explicit timestamp
    await incrementRuleHit(ruleId, 1000);

    // Assert first hit
    const afterFirst = await db.rules.get(ruleId);
    expect(afterFirst?.hits).toBe(1);
    expect(afterFirst?.lastHitAt).toBe(1000);

    // Act — second hit with a different timestamp
    await incrementRuleHit(ruleId, 2000);

    // Assert second hit
    const afterSecond = await db.rules.get(ruleId);
    expect(afterSecond?.hits).toBe(2);
    expect(afterSecond?.lastHitAt).toBe(2000);
  });
});
