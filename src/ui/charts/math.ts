// Pure math helpers for chart primitives. Kept separate from React to make
// the numeric behavior easily unit-testable without DOM.

export function ringOffset(
  size: number,
  stroke: number,
  value: number,
  max: number,
): { radius: number; circumference: number; offset: number } {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(1, Math.max(0, max <= 0 ? 0 : value / max));
  const offset = circumference * (1 - pct);
  return { radius, circumference, offset };
}

export interface DonutSegment {
  value: number;
  color: string;
}

export interface DonutArc {
  color: string;
  len: number;
  offset: number;
}

export function donutArcs(data: DonutSegment[], circumference: number): DonutArc[] {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return [];
  let acc = 0;
  const arcs: DonutArc[] = [];
  for (const d of data) {
    const len = (d.value / total) * circumference;
    arcs.push({ color: d.color, len, offset: -acc });
    acc += len;
  }
  return arcs;
}

export interface Point2D {
  x: number;
  y: number;
}

export function linePath(
  data: readonly number[],
  w: number,
  h: number,
  minOverride?: number,
): { pts: Point2D[]; d: string } {
  if (data.length === 0) return { pts: [], d: '' };
  const max = Math.max(...data);
  const min = minOverride ?? Math.min(...data, 0);
  const range = max - min || 1;
  const denom = data.length - 1 || 1;
  const step = w / denom;
  const pts: Point2D[] = data.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / range) * h,
  }));
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  return { pts, d };
}

export function sparkPath(
  data: readonly number[],
  w: number,
  h: number,
): { pts: Point2D[]; d: string } {
  if (data.length === 0) return { pts: [], d: '' };
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const denom = data.length - 1 || 1;
  const step = w / denom;
  const pts: Point2D[] = data.map((v, i) => ({
    x: i * step,
    y: h - ((v - min) / range) * h,
  }));
  const d = pts
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');
  return { pts, d };
}

export interface StackedBarPoint {
  in: number;
  out: number;
}

export interface StackedBarGeom {
  x: number;
  width: number;
  yMid: number;
  inTop: number;
  inHeight: number;
  outTop: number;
  outHeight: number;
}

export function stackedBarsGeom(
  data: readonly StackedBarPoint[],
  w: number,
  h: number,
): StackedBarGeom[] {
  if (data.length === 0) return [];
  const maxVal = Math.max(...data.map((d) => Math.max(d.in, d.out))) || 1;
  const bw = (w / data.length) * 0.7;
  const gap = (w / data.length) * 0.3;
  const yMid = h / 2;
  return data.map((d, i) => {
    const x = i * (bw + gap) + gap / 2;
    const hIn = (d.in / maxVal) * (h / 2) * 0.9;
    const hOut = (d.out / maxVal) * (h / 2) * 0.9;
    return {
      x,
      width: bw,
      yMid,
      inTop: yMid - hIn,
      inHeight: hIn,
      outTop: yMid,
      outHeight: hOut,
    };
  });
}

export interface HeatmapCell {
  x: number;
  y: number;
  width: number;
  height: number;
  intensity: number;
  isEmpty: boolean;
}

export function heatmapGeom(
  data: readonly number[],
  w: number,
  h: number,
  cols: number,
): HeatmapCell[] {
  if (data.length === 0) return [];
  const max = Math.max(...data) || 1;
  const rows = Math.ceil(data.length / cols);
  const cw = w / cols - 2;
  const ch = h / rows - 2;
  return data.map((v, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: col * (cw + 2),
      y: row * (ch + 2),
      width: cw,
      height: ch,
      intensity: v / max,
      isEmpty: v === 0,
    };
  });
}

export interface StackBarSegment {
  value: number;
  color: string;
}

export function stackBarFlex(data: readonly StackBarSegment[]): number[] {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return data.map(() => 0);
  return data.map((d) => d.value / total);
}
