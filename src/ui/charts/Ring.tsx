import type { ReactNode } from 'react';
import { ringOffset } from './math';

interface Props {
  size?: number;
  stroke?: number;
  value: number;
  max?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}

export function Ring({
  size = 78,
  stroke = 5,
  value,
  max = 100,
  color = '#8fc088',
  track = '#0e0f11',
  children,
}: Props) {
  const { radius, circumference, offset } = ringOffset(size, stroke, value, max);
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} data-testid="ring">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={track}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          data-testid="ring-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {children && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
      )}
    </div>
  );
}
