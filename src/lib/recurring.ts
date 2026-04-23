import { db } from '@/db/database';
import type { Recurring, Transaction } from '@/types';
import { normalizeDesc } from '@/lib/importers/parse-helpers';
import { effectiveAmount } from '@/db/queries';

function signatureFor(tx: Pick<Transaction, 'merchant' | 'description'>): string {
  const key = tx.merchant || tx.description.split(' — ')[0] || tx.description;
  return normalizeDesc(key).slice(0, 60);
}

export async function detectRecurring(): Promise<Recurring[]> {
  const all = await db.transactions.toArray();
  const groups = new Map<string, Transaction[]>();
  for (const t of all) {
    const sig = signatureFor(t);
    if (!sig) continue;
    const arr = groups.get(sig) ?? [];
    arr.push(t);
    groups.set(sig, arr);
  }
  const found: Recurring[] = [];
  for (const [sig, items] of groups) {
    if (items.length < 3) continue;
    // Same kind
    const kinds = new Set(items.map((i) => i.kind));
    if (kinds.size !== 1) continue;
    const kind = items[0].kind;
    if (kind === 'transfer') continue;
    // Sort by date
    items.sort((a, b) => a.date.localeCompare(b.date));
    const dates = items.map((i) => new Date(i.date + 'T00:00:00').getTime());
    const gaps: number[] = [];
    for (let i = 1; i < dates.length; i++) gaps.push((dates[i] - dates[i - 1]) / 86400000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    // Look for monthly-ish cadence (25-35 days) or weekly-ish (6-8) with consistent amounts
    const amounts = items.map((i) => effectiveAmount(i));
    const avgAmt = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const deviation =
      amounts.reduce((a, b) => a + Math.abs(b - avgAmt), 0) / amounts.length / Math.max(avgAmt, 1);
    const cadenceOk =
      (avgGap >= 20 && avgGap <= 35) ||
      (avgGap >= 6 && avgGap <= 8) ||
      (avgGap >= 13 && avgGap <= 16);
    if (!cadenceOk) continue;
    if (deviation > 0.3) continue;
    found.push({
      signature: sig,
      averageAmount: Math.round(avgAmt * 100) / 100,
      cadenceDays: Math.round(avgGap),
      lastSeen: items[items.length - 1].date,
      sampleCount: items.length,
      kind,
      categoryId: items[items.length - 1].categoryId,
    });
  }
  // Persist
  await db.recurring.clear();
  if (found.length > 0) await db.recurring.bulkAdd(found);
  return found;
}
