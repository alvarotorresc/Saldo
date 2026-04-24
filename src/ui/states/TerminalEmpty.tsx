import type { ReactNode } from 'react';

export interface TerminalEmptyProps {
  title: string;
  subtitle?: string;
  terminalLine?: string;
  actions?: ReactNode;
  'data-testid'?: string;
}

/**
 * Terminal/ASCII-style empty state. Used by Ledger, Goals, Rules, etc.
 * Variants are created by passing different `title` / `terminalLine` copy.
 */
export function TerminalEmpty({
  title,
  subtitle,
  terminalLine,
  actions,
  ...rest
}: TerminalEmptyProps) {
  return (
    <div
      className="flex-1 flex flex-col items-center justify-center px-6 py-10 text-center"
      data-testid={rest['data-testid'] ?? 'terminal-empty'}
    >
      <pre
        aria-hidden="true"
        className="font-mono text-mono10 text-dim leading-tight mb-4 whitespace-pre"
      >{`┌──────────────┐
│    NO DATA   │
└──────────────┘`}</pre>
      <h2 className="font-mono text-mono12 text-text tracking-wide uppercase">{title}</h2>
      {subtitle && <p className="mt-1 font-mono text-mono10 text-muted">{subtitle}</p>}
      {terminalLine && (
        <p className="mt-3 font-mono text-mono9 text-dim">
          <span className="text-accent">$ </span>
          {terminalLine}
        </p>
      )}
      {actions && <div className="mt-4 flex gap-2 justify-center">{actions}</div>}
    </div>
  );
}
