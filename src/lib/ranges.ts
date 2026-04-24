export type RangeKey = '7D' | '30D' | '90D' | '12M' | 'YTD';

export const RANGE_KEYS: readonly RangeKey[] = ['7D', '30D', '90D', '12M', 'YTD'];

/**
 * Returns the number of days covered by a range key, counting `endDateISO` as
 * day 1. For YTD this is the days elapsed since the first of January.
 */
export function rangeToDays(range: RangeKey, endDateISO: string): number {
  switch (range) {
    case '7D':
      return 7;
    case '30D':
      return 30;
    case '90D':
      return 90;
    case '12M':
      return 365;
    case 'YTD': {
      const d = new Date(endDateISO + 'T00:00:00Z');
      if (Number.isNaN(d.getTime())) return 1;
      const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
      const days = Math.round((d.getTime() - jan1) / 86400000) + 1;
      return Math.max(1, days);
    }
  }
}

export interface DonutSlice<Id = number | string> {
  id: Id;
  value: number;
  color: string;
  label: string;
}

/**
 * Pure helper: collapses slices below `thresholdPct` into a single `OTROS`
 * slice. The resulting list stays sorted by value descending, with the
 * collapsed bucket pushed last when present. If no slice qualifies, returns
 * the input sorted (no new bucket added).
 */
export function collapseSmallSegments<Id>(
  slices: readonly DonutSlice<Id>[],
  thresholdPct = 5,
  otrosColor = '#8A8A93',
): DonutSlice<Id | 'otros'>[] {
  const total = slices.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return [];
  const kept: DonutSlice<Id | 'otros'>[] = [];
  let collapsed = 0;
  for (const s of slices) {
    const pct = (s.value / total) * 100;
    if (pct < thresholdPct) {
      collapsed += s.value;
    } else {
      kept.push(s);
    }
  }
  kept.sort((a, b) => b.value - a.value);
  if (collapsed > 0) {
    kept.push({ id: 'otros', value: collapsed, color: otrosColor, label: 'OTROS' });
  }
  return kept;
}
