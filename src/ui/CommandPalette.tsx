import { useEffect, useMemo, useRef, useState } from 'react';
import { fuzzyRank } from '@/lib/fuzzy';

export interface Command {
  id: string;
  label: string;
  hint?: string;
  onRun: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  commands: readonly Command[];
}

export function CommandPalette({ open, onClose, commands }: Props) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActive(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => {
    return fuzzyRank(
      query,
      commands.map((c) => ({ item: c, haystack: `${c.label} ${c.hint ?? ''}` })),
    );
  }, [query, commands]);

  useEffect(() => {
    if (filtered.length > 0 && active >= filtered.length) setActive(0);
  }, [filtered.length, active]);

  if (!open) return null;

  const run = (cmd: Command) => {
    cmd.onRun();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Paleta de comandos"
      data-testid="cmd-palette"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md mt-16 bg-bg border border-border rounded-xs overflow-hidden">
        <div className="border-b border-border px-3 py-2 flex items-center gap-2">
          <span className="font-mono text-accent">$</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActive((i) => Math.min(i + 1, filtered.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                const cmd = filtered[active];
                if (cmd) run(cmd);
              }
            }}
            placeholder="buscar comando…"
            className="flex-1 bg-transparent font-mono text-mono12 text-text focus:outline-none"
            data-testid="cmd-input"
          />
        </div>
        <ul className="max-h-80 overflow-auto" data-testid="cmd-list">
          {filtered.length === 0 ? (
            <li className="px-3 py-3 font-mono text-mono10 text-dim">No commands match</li>
          ) : (
            filtered.map((cmd, i) => (
              <li
                key={cmd.id}
                onMouseEnter={() => setActive(i)}
                onClick={() => run(cmd)}
                className={[
                  'px-3 py-2 cursor-pointer flex justify-between',
                  i === active ? 'bg-surface text-accent' : 'text-text',
                ].join(' ')}
                data-testid={`cmd-item-${cmd.id}`}
              >
                <span className="font-mono text-mono11">{cmd.label}</span>
                {cmd.hint && <span className="font-mono text-mono9 text-dim">{cmd.hint}</span>}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
