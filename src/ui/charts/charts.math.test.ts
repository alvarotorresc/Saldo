import { describe, expect, it } from 'vitest';
import {
  donutArcs,
  heatmapGeom,
  linePath,
  ringOffset,
  sparkPath,
  stackBarFlex,
  stackedBarsGeom,
} from './math';

describe('ringOffset', () => {
  it('returns zero offset at full value', () => {
    const { offset, circumference } = ringOffset(100, 10, 100, 100);
    expect(offset).toBeCloseTo(0);
    expect(circumference).toBeGreaterThan(0);
  });

  it('returns full circumference offset at zero value', () => {
    const { offset, circumference } = ringOffset(100, 10, 0, 100);
    expect(offset).toBeCloseTo(circumference);
  });

  it('clamps values above max to 100%', () => {
    const { offset } = ringOffset(100, 10, 999, 100);
    expect(offset).toBeCloseTo(0);
  });

  it('clamps negative values to 0%', () => {
    const { offset, circumference } = ringOffset(100, 10, -5, 100);
    expect(offset).toBeCloseTo(circumference);
  });

  it('treats max<=0 as zero progress', () => {
    const { offset, circumference } = ringOffset(100, 10, 50, 0);
    expect(offset).toBeCloseTo(circumference);
  });

  it('radius subtracts stroke', () => {
    const { radius } = ringOffset(100, 10, 50, 100);
    expect(radius).toBe(45);
  });
});

describe('donutArcs', () => {
  it('sums to full circumference', () => {
    const arcs = donutArcs(
      [
        { value: 1, color: 'a' },
        { value: 2, color: 'b' },
        { value: 3, color: 'c' },
      ],
      600,
    );
    const totalLen = arcs.reduce((s, a) => s + a.len, 0);
    expect(totalLen).toBeCloseTo(600);
  });

  it('offsets are cumulative and negative', () => {
    const arcs = donutArcs(
      [
        { value: 50, color: 'a' },
        { value: 50, color: 'b' },
      ],
      1000,
    );
    expect(arcs[0].offset).toBeCloseTo(0);
    expect(arcs[1].offset).toBeCloseTo(-500);
  });

  it('returns empty when total is zero', () => {
    expect(donutArcs([], 100)).toEqual([]);
    expect(donutArcs([{ value: 0, color: 'a' }], 100)).toEqual([]);
  });

  it('preserves input color', () => {
    const arcs = donutArcs([{ value: 1, color: '#ff00ff' }], 100);
    expect(arcs[0].color).toBe('#ff00ff');
  });
});

describe('linePath', () => {
  it('starts with M and has one L per subsequent point', () => {
    const { d } = linePath([1, 2, 3, 4], 100, 50);
    expect(d.startsWith('M')).toBe(true);
    expect((d.match(/L/g) || []).length).toBe(3);
  });

  it('empty input returns empty path', () => {
    expect(linePath([], 100, 50)).toEqual({ pts: [], d: '' });
  });

  it('flat series maps to mid-ish Y when min=0', () => {
    const { pts } = linePath([5, 5, 5], 100, 50);
    for (const p of pts) {
      expect(p.y).toBeCloseTo(0);
    }
  });

  it('spans full width', () => {
    const { pts } = linePath([1, 2, 3], 300, 100);
    expect(pts[0].x).toBeCloseTo(0);
    expect(pts[pts.length - 1].x).toBeCloseTo(300);
  });
});

describe('sparkPath', () => {
  it('respects own min (not clamped to 0)', () => {
    const { pts } = sparkPath([10, 20, 30], 100, 50);
    expect(pts[0].y).toBeCloseTo(50);
    expect(pts[pts.length - 1].y).toBeCloseTo(0);
  });

  it('single point produces an M command with no L', () => {
    const { d } = sparkPath([42], 100, 50);
    expect(d.startsWith('M')).toBe(true);
    expect(d.includes('L')).toBe(false);
  });
});

describe('stackedBarsGeom', () => {
  it('produces n geometries', () => {
    const geom = stackedBarsGeom(
      [
        { in: 10, out: 5 },
        { in: 3, out: 8 },
      ],
      100,
      100,
    );
    expect(geom).toHaveLength(2);
  });

  it('yMid is always h/2', () => {
    const geom = stackedBarsGeom([{ in: 1, out: 1 }], 100, 120);
    expect(geom[0].yMid).toBe(60);
  });

  it('bars never exceed half-height', () => {
    const geom = stackedBarsGeom(
      [
        { in: 100, out: 100 },
        { in: 10, out: 10 },
      ],
      200,
      100,
    );
    for (const g of geom) {
      expect(g.inHeight).toBeLessThanOrEqual(50);
      expect(g.outHeight).toBeLessThanOrEqual(50);
    }
  });

  it('empty input returns empty geom', () => {
    expect(stackedBarsGeom([], 100, 50)).toEqual([]);
  });
});

describe('heatmapGeom', () => {
  it('cells match col/row from index', () => {
    const geom = heatmapGeom([1, 2, 3, 4, 5], 100, 20, 3);
    expect(geom).toHaveLength(5);
    // index 4 → col 1, row 1
    expect(geom[4].x).toBeCloseTo(geom[1].x);
  });

  it('marks zero values as empty', () => {
    const geom = heatmapGeom([0, 1, 0, 2], 50, 10, 2);
    expect(geom[0].isEmpty).toBe(true);
    expect(geom[1].isEmpty).toBe(false);
  });

  it('intensity is normalized to [0,1]', () => {
    const geom = heatmapGeom([1, 2, 4], 50, 10, 3);
    expect(geom[0].intensity).toBeCloseTo(0.25);
    expect(geom[2].intensity).toBeCloseTo(1);
  });
});

describe('stackBarFlex', () => {
  it('normalizes to [0,1]', () => {
    const flex = stackBarFlex([
      { value: 25, color: 'a' },
      { value: 75, color: 'b' },
    ]);
    expect(flex[0]).toBeCloseTo(0.25);
    expect(flex[1]).toBeCloseTo(0.75);
  });

  it('returns zeros when total is zero', () => {
    const flex = stackBarFlex([
      { value: 0, color: 'a' },
      { value: 0, color: 'b' },
    ]);
    expect(flex).toEqual([0, 0]);
  });
});
