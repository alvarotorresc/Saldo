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
