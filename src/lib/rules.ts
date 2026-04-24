import { db } from '@/db/database';
import type { Rule, Transaction } from '@/types';
import { normalizeDesc } from '@/lib/importers/parse-helpers';

/**
 * Pure helper: returns the first matching rule (sorted by priority desc) for a
 * given haystack (already normalised), considering only enabled rules.
 * Rules with `enabled === undefined` are treated as enabled for back-compat.
 */
export function matchRule(rules: readonly Rule[], haystack: string): Rule | undefined {
  const sorted = [...rules].filter((r) => r.enabled !== 0).sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    if (haystack.includes(normalizeDesc(r.pattern))) return r;
  }
  return undefined;
}

/** Pure helper: counts how many txs would be re-categorised by a rule. */
export function previewMatches(rule: Pick<Rule, 'pattern'>, txs: readonly Transaction[]): number {
  const needle = normalizeDesc(rule.pattern);
  if (!needle) return 0;
  let n = 0;
  for (const t of txs) {
    if (t.kind !== 'expense' && t.kind !== 'income') continue;
    const hay = normalizeDesc(`${t.merchant ?? ''} ${t.description}`);
    if (hay.includes(needle)) n++;
  }
  return n;
}

export async function incrementRuleHit(ruleId: number, when = Date.now()): Promise<void> {
  const r = await db.rules.get(ruleId);
  if (!r) return;
  await db.rules.update(ruleId, { hits: (r.hits ?? 0) + 1, lastHitAt: when });
}

export interface ReapplyResult {
  updated: number;
  changed: Map<number, number>; // txId -> new categoryId
}

/**
 * Pure: projects which txs would change category if rules were re-applied.
 * Txs already matching the matched rule's categoryId are skipped.
 */
export function reapplyPlan(txs: readonly Transaction[], rules: readonly Rule[]): ReapplyResult {
  const changed = new Map<number, number>();
  for (const t of txs) {
    if (t.id == null) continue;
    if (t.kind === 'transfer') continue;
    const hay = normalizeDesc(`${t.merchant ?? ''} ${t.description}`);
    const matched = matchRule(rules, hay);
    if (!matched) continue;
    if (matched.categoryId !== t.categoryId) {
      changed.set(t.id, matched.categoryId);
    }
  }
  return { updated: changed.size, changed };
}

/**
 * Re-applies current rule set to all txs of a given month. Returns the count
 * of updated txs and bumps hits/lastHitAt on each rule that matched at least
 * one tx. Used by LedgerPage pull-to-refresh.
 */
export async function reapplyMonth(month: string): Promise<number> {
  const [rules, txs] = await Promise.all([
    db.rules.toArray(),
    db.transactions.where('month').equals(month).toArray(),
  ]);
  const plan = reapplyPlan(txs, rules);
  if (plan.updated === 0) return 0;

  // Aggregate rule hits: collect matches per rule so we bump hits once per tx.
  const hitsByRule = new Map<number, number>();
  for (const t of txs) {
    if (t.id == null) continue;
    const hay = normalizeDesc(`${t.merchant ?? ''} ${t.description}`);
    const matched = matchRule(rules, hay);
    if (matched?.id != null && plan.changed.has(t.id)) {
      hitsByRule.set(matched.id, (hitsByRule.get(matched.id) ?? 0) + 1);
    }
  }

  const now = Date.now();
  await db.transaction('rw', db.transactions, db.rules, async () => {
    for (const [txId, categoryId] of plan.changed) {
      await db.transactions.update(txId, { categoryId });
    }
    for (const [ruleId, delta] of hitsByRule) {
      const r = await db.rules.get(ruleId);
      if (!r) continue;
      await db.rules.update(ruleId, { hits: (r.hits ?? 0) + delta, lastHitAt: now });
    }
  });
  return plan.updated;
}
