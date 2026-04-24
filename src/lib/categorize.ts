import { db } from '@/db/database';
import type { Rule, Transaction } from '@/types';
import { normalizeDesc } from '@/lib/importers/parse-helpers';
import { incrementRuleHit, matchRule } from '@/lib/rules';

let rulesCache: Rule[] | null = null;

export async function getRules(): Promise<Rule[]> {
  if (!rulesCache) {
    rulesCache = await db.rules.toArray();
    rulesCache.sort((a, b) => b.priority - a.priority);
  }
  return rulesCache;
}

export function invalidateRulesCache() {
  rulesCache = null;
}

export async function categorize(
  tx: Pick<Transaction, 'description' | 'merchant' | 'kind'>,
): Promise<number | undefined> {
  const rules = await getRules();
  const hay = normalizeDesc(`${tx.merchant ?? ''} ${tx.description}`);
  const matched = matchRule(rules, hay);
  if (matched?.id != null) {
    void incrementRuleHit(matched.id);
    return matched.categoryId;
  }
  // fallback defaults by kind: prefer a builtin "Otros" category so user renames do not break it
  const kind = tx.kind === 'expense' ? 'expense' : 'income';
  const fallback = await db.categories.where('kind').equals(kind).toArray();
  const builtinOther = fallback.find(
    (c) => c.builtin === 1 && c.name.toLowerCase().startsWith('otros'),
  );
  if (builtinOther?.id) return builtinOther.id;
  // Next preference: any builtin category of this kind (renamed but still marked builtin)
  const anyBuiltin = fallback.find((c) => c.builtin === 1);
  if (anyBuiltin?.id) return anyBuiltin.id;
  // Last-resort: legacy name-based match for DBs without builtin flag yet
  const legacy = fallback.find((c) => c.name.startsWith('Otros'));
  return legacy?.id;
}
