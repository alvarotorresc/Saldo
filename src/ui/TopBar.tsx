import type { ReactNode } from 'react';

interface Props {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function TopBar({ title, subtitle, leading, trailing }: Props) {
  return (
    <header
      className="shrink-0 px-4 pb-3 flex items-end justify-between gap-3"
      style={{ paddingTop: 'calc(var(--sat) + 14px)' }}
    >
      <div className="min-w-0 flex items-center gap-2">
        {leading}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight truncate">{title}</h1>
          {subtitle && <p className="text-xs text-muted truncate mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="flex items-center gap-2">{trailing}</div>
    </header>
  );
}
