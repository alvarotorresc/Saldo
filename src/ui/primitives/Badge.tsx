import type { ReactNode } from 'react';

export type BadgeTone = 'muted' | 'ok' | 'warn' | 'danger' | 'info' | 'solid';

interface Props {
  children: ReactNode;
  tone?: BadgeTone;
  className?: string;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  muted: 'text-muted border-border bg-surface',
  ok: 'text-accent bg-[#122018] border-[#1d3324]',
  warn: 'text-warning bg-[#201a12] border-[#33281d]',
  danger: 'text-danger bg-[#201414] border-[#331c1c]',
  info: 'text-info bg-[#122028] border-[#1d2a33]',
  solid: 'text-[#061208] bg-accent border-accent',
};

export function Badge({ children, tone = 'muted', className = '' }: Props) {
  return (
    <span
      data-tone={tone}
      className={`inline-flex items-center gap-1 whitespace-nowrap border px-1.5 py-[3px] rounded-xs font-mono text-mono9 uppercase tracking-wider ${TONE_CLASSES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
