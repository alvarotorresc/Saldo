import { useMemo } from 'react';

interface Props {
  series: { label: string; values: { x: string; y: number }[]; color: string; fill?: boolean }[];
  height?: number;
  formatY?: (n: number) => string;
  xLabels?: string[];
}

export function LineChart({ series, height = 180, formatY, xLabels }: Props) {
  const data = useMemo(() => {
    if (series.length === 0) return null;
    const xs = series[0].values.map((v) => v.x);
    let min = Infinity;
    let max = -Infinity;
    for (const s of series) {
      for (const v of s.values) {
        if (v.y < min) min = v.y;
        if (v.y > max) max = v.y;
      }
    }
    if (min === Infinity) return null;
    if (min === max) {
      // Flat series: center around value without crossing zero artificially
      if (min === 0) {
        min = -1;
        max = 1;
      } else if (min > 0) {
        max = min + Math.abs(min) * 0.2;
        min = 0;
      } else {
        min = min - Math.abs(min) * 0.2;
        max = 0;
      }
    } else {
      const range = max - min;
      const pad = range * 0.1;
      // Don't push min below zero if all data is non-negative
      if (min >= 0) {
        min = 0;
        max += pad;
      } else if (max <= 0) {
        // All data non-positive: don't push max above zero
        min -= pad;
        max = 0;
      } else {
        min -= pad;
        max += pad;
      }
    }
    return { xs, min, max };
  }, [series]);

  if (!data || series[0]?.values.length === 0) {
    return (
      <div
        className="grid place-items-center text-xs text-dim border border-dashed border-border rounded-xl"
        style={{ height }}
      >
        Sin datos
      </div>
    );
  }

  const w = 320;
  const h = height;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 8;
  const padBottom = 24;
  const chartW = w - padLeft - padRight;
  const chartH = h - padTop - padBottom;
  const n = data.xs.length;
  const stepX = n > 1 ? chartW / (n - 1) : chartW;
  const scaleY = (y: number) => padTop + chartH - ((y - data.min) / (data.max - data.min)) * chartH;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" preserveAspectRatio="none">
      {/* grid */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={padLeft}
          x2={w - padRight}
          y1={padTop + chartH * p}
          y2={padTop + chartH * p}
          stroke="#1F1F23"
          strokeDasharray="2 4"
        />
      ))}
      {/* zero line */}
      {data.min < 0 && data.max > 0 && (
        <line x1={padLeft} x2={w - padRight} y1={scaleY(0)} y2={scaleY(0)} stroke="#2A2A30" />
      )}
      {series.map((s, si) => {
        const points = s.values.map((v, i) => `${padLeft + i * stepX},${scaleY(v.y)}`).join(' ');
        const fillPath =
          s.fill && s.values.length > 0
            ? `M ${padLeft},${scaleY(0)} L ${points.split(' ').join(' L ')} L ${padLeft + (s.values.length - 1) * stepX},${scaleY(0)} Z`
            : null;
        return (
          <g key={si}>
            {fillPath && <path d={fillPath} fill={s.color} opacity={0.15} />}
            <polyline
              points={points}
              fill="none"
              stroke={s.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {s.values.map((v, i) => (
              <circle key={i} cx={padLeft + i * stepX} cy={scaleY(v.y)} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}
      {(xLabels ?? data.xs).map((x, i) => {
        if (n > 7 && i % Math.ceil(n / 6) !== 0 && i !== n - 1) return null;
        return (
          <text
            key={i}
            x={padLeft + i * stepX}
            y={h - 6}
            fontSize="9"
            fill="#5A5A63"
            textAnchor="middle"
          >
            {x}
          </text>
        );
      })}
      {formatY && (
        <>
          <text x={padLeft + 2} y={scaleY(data.max) + 10} fontSize="9" fill="#5A5A63">
            {formatY(data.max)}
          </text>
          <text x={padLeft + 2} y={scaleY(data.min) - 2} fontSize="9" fill="#5A5A63">
            {formatY(data.min)}
          </text>
        </>
      )}
    </svg>
  );
}
