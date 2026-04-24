import { describe, it, expect } from 'vitest';
import { rangeToDays, collapseSmallSegments, RANGE_KEYS } from './ranges';

describe('rangeToDays', () => {
  it('maps fixed ranges to their day counts', () => {
    expect(rangeToDays('7D', '2026-04-24')).toBe(7);
    expect(rangeToDays('30D', '2026-04-24')).toBe(30);
    expect(rangeToDays('90D', '2026-04-24')).toBe(90);
    expect(rangeToDays('12M', '2026-04-24')).toBe(365);
  });

  it('returns the elapsed days of the current year for YTD', () => {
    // 2026-04-24 is the 114th day of 2026 (Jan=31 + Feb=28 + Mar=31 + Apr=24).
    expect(rangeToDays('YTD', '2026-04-24')).toBe(114);
  });

  it('falls back to 1 day when YTD is asked for an invalid date string', () => {
    expect(rangeToDays('YTD', 'not-a-date')).toBe(1);
  });

  it('exposes the canonical ordered range key list consumed by the selector', () => {
    expect(RANGE_KEYS).toEqual(['7D', '30D', '90D', '12M', 'YTD']);
  });
});

describe('collapseSmallSegments', () => {
  it('collapses slices below the threshold into a single OTROS bucket pushed last', () => {
    const out = collapseSmallSegments(
      [
        { id: 1, value: 60, color: '#111', label: 'A' },
        { id: 2, value: 30, color: '#222', label: 'B' },
        { id: 3, value: 5, color: '#333', label: 'C' },
        { id: 4, value: 3, color: '#444', label: 'D' },
        { id: 5, value: 2, color: '#555', label: 'E' },
      ],
      5,
    );
    // A=60%, B=30%, C=5%, D=3%, E=2%. Threshold 5 keeps >=5: A, B, C (5% is not <5).
    expect(out.map((s) => s.label)).toEqual(['A', 'B', 'C', 'OTROS']);
    expect(out[out.length - 1].value).toBe(5);
  });

  it('leaves the list untouched and sorted when no slice falls below the threshold', () => {
    const out = collapseSmallSegments(
      [
        { id: 1, value: 40, color: '#111', label: 'A' },
        { id: 2, value: 60, color: '#222', label: 'B' },
      ],
      5,
    );
    expect(out.map((s) => s.label)).toEqual(['B', 'A']);
  });

  it('returns [] when total value is 0', () => {
    expect(
      collapseSmallSegments([
        { id: 1, value: 0, color: '#111', label: 'A' },
        { id: 2, value: 0, color: '#222', label: 'B' },
      ]),
    ).toEqual([]);
  });

  it('produces a single OTROS entry when every slice is under the threshold', () => {
    const out = collapseSmallSegments(
      [
        { id: 1, value: 1, color: '#111', label: 'A' },
        { id: 2, value: 1, color: '#222', label: 'B' },
        { id: 3, value: 1, color: '#333', label: 'C' },
      ],
      50,
    );
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('OTROS');
    expect(out[0].value).toBe(3);
  });
});
