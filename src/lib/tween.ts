import { useEffect, useRef, useState } from 'react';

export function easeOutCubic(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - c, 3);
}

export function tweenNumber(from: number, to: number, t: number): number {
  return from + (to - from) * easeOutCubic(t);
}

/**
 * Animates a numeric value from the previous target to the current one,
 * easing-out over `durationMs`. When the target changes mid-flight, the
 * animation restarts from the current displayed value so the motion stays
 * smooth. Respects `prefers-reduced-motion`: returns the target immediately.
 */
export function useTweenedNumber(target: number, durationMs = 700): number {
  const [value, setValue] = useState<number>(target);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef<number>(target);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || durationMs <= 0) {
      setValue(target);
      return;
    }

    fromRef.current = value;
    startRef.current = null;

    const step = (now: number): void => {
      if (startRef.current == null) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / durationMs);
      setValue(tweenNumber(fromRef.current, target, t));
      if (t < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
