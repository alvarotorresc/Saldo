import type { ReactNode } from 'react';

interface Props {
  label: ReactNode;
  value: ReactNode;
  valueClassName?: string;
  className?: string;
}

export function KV({ label, value, valueClassName = 'text-text', className = '' }: Props) {
  return (
    <div
      className={`flex items-center justify-between py-2.5 border-b border-border last:border-b-0 ${className}`}
    >
      <span className="font-mono text-mono10 text-dim uppercase tracking-wider">{label}</span>
      <span className={`font-mono text-mono12 tabular ${valueClassName}`}>{value}</span>
    </div>
  );
}
