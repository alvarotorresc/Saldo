import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  unit?: ReactNode;
  delta?: ReactNode;
  deltaClassName?: string;
  chart?: ReactNode;
  className?: string;
}

export function Metric({
  label,
  value,
  unit,
  delta,
  deltaClassName = 'text-dim',
  chart,
  className = '',
}: Props) {
  return (
    <div className={`px-3.5 py-3 ${className}`}>
      <div className="font-mono text-[8.5px] leading-[11px] text-dim uppercase tracking-widest">
        {label}
      </div>
      <div className="font-mono text-sans14 text-text mt-1 tabular">
        {value}
        {unit !== undefined && <span className="text-muted text-mono9 ml-0.5">{unit}</span>}
      </div>
      {delta !== undefined && (
        <div className={`font-mono text-mono9 mt-1 ${deltaClassName}`}>{delta}</div>
      )}
      {chart !== undefined && <div className="mt-1.5 text-accent/60">{chart}</div>}
    </div>
  );
}
