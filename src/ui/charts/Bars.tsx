interface Props {
  data: readonly number[];
  w?: number;
  h?: number;
  color?: string;
  grid?: string;
  className?: string;
}

export function Bars({
  data,
  w = 320,
  h = 100,
  color = '#8fc088',
  grid = '#1e2126',
  className = '',
}: Props) {
  const max = Math.max(...data) || 1;
  const bw = (w / data.length) * 0.7;
  const gap = (w / data.length) * 0.3;
  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className={`block ${className}`}
      data-testid="bars"
      aria-hidden="true"
    >
      <g stroke={grid} strokeWidth={0.5} strokeDasharray="2 3">
        <line x1="0" y1={h * 0.5} x2={w} y2={h * 0.5} />
      </g>
      {data.map((v, i) => {
        const x = i * (bw + gap) + gap / 2;
        const bh = (v / max) * h * 0.95;
        return (
          <rect
            key={i}
            x={x}
            y={h - bh}
            width={bw}
            height={bh}
            fill={color}
            opacity={0.85}
            data-testid="bar"
          />
        );
      })}
    </svg>
  );
}
