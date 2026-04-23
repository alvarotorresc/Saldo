import { stackBarFlex, type StackBarSegment } from './math';

interface Props {
  data: readonly StackBarSegment[];
  h?: number;
  gap?: number;
  className?: string;
}

export function StackBar({ data, h = 6, gap = 1, className = '' }: Props) {
  const flexes = stackBarFlex(data);
  return (
    <div
      className={`flex overflow-hidden rounded-[1px] ${className}`}
      style={{ height: h, gap }}
      data-testid="stack-bar"
    >
      {data.map((d, i) => (
        <div
          key={i}
          data-testid="stack-bar-seg"
          style={{ flex: flexes[i], background: d.color, opacity: 0.9 }}
        />
      ))}
    </div>
  );
}
