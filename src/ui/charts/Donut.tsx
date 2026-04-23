import { donutArcs, type DonutSegment } from './math';

interface Props {
  size?: number;
  stroke?: number;
  data: DonutSegment[];
  track?: string;
}

export function Donut({ size = 140, stroke = 18, data, track = '#0e0f11' }: Props) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcs = donutArcs(data, circumference);
  return (
    <svg
      width={size}
      height={size}
      style={{ transform: 'rotate(-90deg)' }}
      data-testid="donut"
      aria-hidden="true"
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={track}
        strokeWidth={stroke}
        fill="none"
      />
      {arcs.map((arc, i) => (
        <circle
          key={i}
          data-testid="donut-arc"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={arc.color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${arc.len} ${circumference - arc.len}`}
          strokeDashoffset={arc.offset}
        />
      ))}
    </svg>
  );
}
