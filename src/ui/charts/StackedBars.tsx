import { stackedBarsGeom, type StackedBarPoint } from './math';

interface Props {
  data: readonly StackedBarPoint[];
  w?: number;
  h?: number;
  inColor?: string;
  outColor?: string;
  grid?: string;
  className?: string;
}

export function StackedBars({
  data,
  w = 320,
  h = 120,
  inColor = '#8fc088',
  outColor = '#c97c7c',
  grid = '#1e2126',
  className = '',
}: Props) {
  const geom = stackedBarsGeom(data, w, h);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`block ${className}`}
      data-testid="stacked-bars"
      aria-hidden="true"
    >
      <g stroke={grid} strokeWidth={0.5} strokeDasharray="2 3">
        <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} />
      </g>
      {geom.map((g, i) => (
        <g key={i}>
          <rect
            x={g.x}
            y={g.inTop}
            width={g.width}
            height={g.inHeight}
            fill={inColor}
            opacity={0.85}
            data-testid="in-bar"
          />
          <rect
            x={g.x}
            y={g.outTop}
            width={g.width}
            height={g.outHeight}
            fill={outColor}
            opacity={0.8}
            data-testid="out-bar"
          />
        </g>
      ))}
    </svg>
  );
}
