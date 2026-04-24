import { useEffect, useState } from 'react';

export type ChecklistStatus = 'pending' | 'running' | 'done' | 'error';

export interface ChecklistStep {
  id: string;
  label: string;
  status: ChecklistStatus;
}

interface Props {
  title?: string;
  steps: readonly ChecklistStep[];
  progress?: number; // 0..1 when known; leave undefined for indeterminate.
}

const SPINNER = ['◐', '◓', '◑', '◒'];

export function TerminalLoading({ title = 'LOADING', steps, progress }: Props) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 120);
    return () => clearInterval(id);
  }, []);
  const spinner = SPINNER[tick % SPINNER.length];

  return (
    <div className="flex-1 px-6 py-10 flex flex-col items-center justify-center text-left">
      <div
        className="font-mono text-mono12 text-accent tracking-widest"
        data-testid="loading-spinner"
      >
        {spinner} {title}
      </div>
      {progress != null && (
        <div className="mt-3 w-48 h-[3px] bg-surface overflow-hidden">
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
          />
        </div>
      )}
      <ul className="mt-4 font-mono text-mono10 text-dim space-y-0.5 min-w-[12rem]">
        {steps.map((s) => (
          <li key={s.id} className="flex gap-2" data-testid={`loading-step-${s.id}`}>
            <span
              className={
                s.status === 'done'
                  ? 'text-accent'
                  : s.status === 'running'
                    ? 'text-text'
                    : s.status === 'error'
                      ? 'text-danger'
                      : 'text-dim'
              }
              aria-hidden
            >
              {s.status === 'done'
                ? '✓'
                : s.status === 'running'
                  ? '…'
                  : s.status === 'error'
                    ? '✗'
                    : '○'}
            </span>
            <span className={s.status === 'done' ? 'text-muted' : 'text-text'}>{s.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
