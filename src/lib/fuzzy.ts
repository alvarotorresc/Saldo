/**
 * Minimal fuzzy matcher used by the Command Palette. Scores each haystack
 * string by how tightly the query letters match in-order.
 *   - Contiguous matches score higher.
 *   - Matches at the start of a word score higher.
 *   - Case-insensitive.
 * Returns a negative score when the query does not match at all.
 */
export function fuzzyScore(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let ti = 0;
  let qi = 0;
  let score = 0;
  let streak = 0;
  let prevMatched = false;
  while (qi < q.length && ti < t.length) {
    if (q[qi] === t[ti]) {
      score += 1;
      if (prevMatched) {
        streak += 1;
        score += streak * 2;
      } else {
        streak = 0;
      }
      if (ti === 0 || /\s|[-_/]/.test(t[ti - 1])) score += 3;
      prevMatched = true;
      qi += 1;
    } else {
      prevMatched = false;
      streak = 0;
    }
    ti += 1;
  }
  if (qi < q.length) return -1;
  // Penalise trailing slack to prefer shorter matches when scores tie.
  return score - Math.max(0, t.length - q.length) * 0.01;
}

export interface FuzzyItem<T> {
  item: T;
  haystack: string;
}

/**
 * Scores and orders the list by fuzzy match. Non-matching items are dropped.
 * Stable tie-breaker by input order.
 */
export function fuzzyRank<T>(query: string, items: readonly FuzzyItem<T>[]): T[] {
  if (!query) return items.map((i) => i.item);
  const scored = items.map((i, idx) => ({
    idx,
    item: i.item,
    score: fuzzyScore(query, i.haystack),
  }));
  return scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((s) => s.item);
}
