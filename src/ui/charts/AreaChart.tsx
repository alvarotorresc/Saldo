import { linePath } from './math';

interface Props {
  data: readonly number[];
  w?: number;
  h?: number;
  color?: string;
  fill?: string;
  grid?: string;
  showGrid?: boolean;
  showDots?: boolean;
  className?: string;
}

export function AreaChart({
  data,
  w = 320,
  h = 120,
  color = '#8fc088',
  fill = 'rgba(143,192,136,.15)',
  grid = '#1e2126',
  showGrid = true,
  showDots = true,
  className = '',
}: Props) {
  const { pts, d } = linePath(data, w, h);
  const fillD = d ? `${d} L${w},${h} L0,${h} Z` : '';
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`block ${className}`}
      data-testid="area-chart"
      aria-hidden="true"
    >
      {showGrid && (
        <g stroke={grid} strokeWidth={0.5} strokeDasharray="2 3">
          <line x1="0" y1={h * 0.25} x2={w} y2={h * 0.25} />
          <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} />
          <line x1="0" y1={h * 0.75} x2={w} y2={h * 0.75} />
        </g>
      )}
      {fillD && <path d={fillD} fill={fill} />}
      {d && (
        <path
          d={d}
          stroke={color}
          strokeWidth={1.25}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {showDots && pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1].x}
          cy={pts[pts.length - 1].y}
          r={2.5}
          fill={color}
          data-testid="area-dot"
        />
      )}
    </svg>
  );
}
