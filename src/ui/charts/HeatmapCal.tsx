import { heatmapGeom } from './math';

interface Props {
  data: readonly number[];
  w?: number;
  h?: number;
  cols?: number;
  color?: string;
  empty?: string;
  className?: string;
}

export function HeatmapCal({
  data,
  w = 320,
  h = 80,
  cols = 15,
  color = '#8fc088',
  empty = '#0e0f11',
  className = '',
}: Props) {
  const geom = heatmapGeom(data, w, h, cols);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`block ${className}`}
      data-testid="heatmap-cal"
      aria-hidden="true"
    >
      {geom.map((cell, i) => (
        <rect
          key={i}
          x={cell.x}
          y={cell.y}
          width={cell.width}
          height={cell.height}
          rx={1}
          fill={cell.isEmpty ? empty : color}
          opacity={cell.isEmpty ? 1 : 0.2 + cell.intensity * 0.8}
          data-testid="heatmap-cell"
        />
      ))}
    </svg>
  );
}
