import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { easeOutCubic, tweenNumber, useTweenedNumber } from './tween';

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('tweenNumber / easeOutCubic', () => {
  it('eases from `from` to `to` with ease-out cubic', () => {
    expect(tweenNumber(0, 100, 0)).toBe(0);
    expect(tweenNumber(0, 100, 1)).toBe(100);
    expect(tweenNumber(0, 100, 0.5)).toBeCloseTo(100 * easeOutCubic(0.5), 5);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });
});

describe('useTweenedNumber', () => {
  it('animates from the initial value to the target over the requested duration', async () => {
    const rafQueue: FrameRequestCallback[] = [];
    const rafSpy = vi
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback): number => {
        rafQueue.push(cb);
        return rafQueue.length;
      });
    vi.spyOn(global, 'cancelAnimationFrame').mockImplementation(() => {});

    const { result, rerender } = renderHook(({ v }: { v: number }) => useTweenedNumber(v, 700), {
      initialProps: { v: 0 },
    });
    expect(result.current).toBe(0);

    rerender({ v: 100 });

    const tick = (ts: number): void => {
      const cb = rafQueue.shift();
      if (!cb) return;
      act(() => {
        cb(ts);
      });
    };

    tick(0); // anchor startRef, still t=0
    tick(350); // ~halfway in time; ease-out puts progress > 50%
    expect(result.current).toBeGreaterThan(50);
    expect(result.current).toBeLessThan(100);

    // Settle to the end.
    let guard = 0;
    while (rafQueue.length > 0 && guard++ < 20) tick(1_000);

    expect(result.current).toBe(100);
    expect(rafSpy).toHaveBeenCalled();
  });
});
