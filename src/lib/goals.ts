import type { Goal } from '@/types';

export interface GoalProgress {
  pct: number; // 0..1
  remaining: number;
  monthsLeft: number | null; // null if no deadline
  monthlyNeeded: number; // 0 when no deadline or already hit target
  onTrack: boolean;
}

/**
 * Pure: goal progress + required monthly contribution to meet the deadline.
 * `now` is injected for determinism in tests. Months left is the ceiling of
 * calendar months between now and deadline (at least 1 to avoid div-by-zero).
 */
export function goalProgress(
  goal: Pick<Goal, 'target' | 'saved' | 'deadline'>,
  now = new Date(),
): GoalProgress {
  const target = Math.max(0, goal.target);
  const saved = Math.max(0, goal.saved);
  const pct = target > 0 ? Math.min(1, saved / target) : 0;
  const remaining = Math.max(0, target - saved);

  if (!goal.deadline) {
    return { pct, remaining, monthsLeft: null, monthlyNeeded: 0, onTrack: remaining === 0 };
  }

  const [y, m] = goal.deadline.split('-').map(Number);
  if (!y || !m) {
    return { pct, remaining, monthsLeft: null, monthlyNeeded: 0, onTrack: remaining === 0 };
  }
  const target2 = new Date(y, m - 1, 1);
  const diffMonths =
    (target2.getFullYear() - now.getFullYear()) * 12 + (target2.getMonth() - now.getMonth());
  const monthsLeft = Math.max(1, diffMonths);
  const monthlyNeeded = remaining > 0 ? remaining / monthsLeft : 0;
  const onTrack = remaining === 0 || monthlyNeeded <= target / Math.max(1, monthsLeft);
  return { pct, remaining, monthsLeft, monthlyNeeded, onTrack };
}
