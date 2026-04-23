import { sparkPath } from './math';

interface Props {
  data: readonly number[];
  w?: number;
  h?: number;
  color?: string;
  stroke?: number;
  fill?: string;
  className?: string;
}

export function Spark({
  data,
  w = 100,
  h = 24,
  color = '#8fc088',
  stroke = 1,
  fill = 'none',
  className = '',
}: Props) {
  const { d } = sparkPath(data, w, h);
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`block ${className}`}
      style={{ overflow: 'visible' }}
      data-testid="spark"
      aria-hidden="true"
    >
      {fill !== 'none' && d && <path d={`${d} L${w},${h} L0,${h} Z`} fill={fill} />}
      {d && (
        <path
          d={d}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
