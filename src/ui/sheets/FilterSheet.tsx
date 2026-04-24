import { useLiveQuery } from 'dexie-react-hooks';
import { useState, useEffect } from 'react';
import { db } from '@/db/database';
import { Sheet } from '@/ui/Sheet';
import { Btn } from '@/ui/primitives';
import {
  EMPTY_FILTER,
  activeFilterCount,
  useLedgerFilter,
  type LedgerFilterState,
  type PeriodKey,
} from '@/stores/ledgerFilter';
import type { TxKind } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'current', label: 'Este mes' },
  { key: 'last', label: 'Anterior' },
  { key: 'all', label: 'Todo' },
];

const KINDS: { key: TxKind; label: string }[] = [
  { key: 'expense', label: 'EXPENSE' },
  { key: 'income', label: 'INCOME' },
  { key: 'transfer', label: 'TRANSFER' },
];

export function FilterSheet({ open, onClose }: Props) {
  const current = useLedgerFilter();
  const [draft, setDraft] = useState<LedgerFilterState>(current);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  useEffect(() => {
    if (open) {
      setDraft({
        period: current.period,
        kinds: current.kinds,
        categoryIds: current.categoryIds,
        minAmount: current.minAmount,
        maxAmount: current.maxAmount,
      });
    }
  }, [
    open,
    current.period,
    current.kinds,
    current.categoryIds,
    current.minAmount,
    current.maxAmount,
  ]);

  const count = activeFilterCount(draft);

  const toggleKind = (k: TxKind) =>
    setDraft((d) => ({
      ...d,
      kinds: d.kinds.includes(k) ? d.kinds.filter((x) => x !== k) : [...d.kinds, k],
    }));

  const toggleCategory = (id: number) =>
    setDraft((d) => ({
      ...d,
      categoryIds: d.categoryIds.includes(id)
        ? d.categoryIds.filter((x) => x !== id)
        : [...d.categoryIds, id],
    }));

  return (
    <Sheet open={open} onClose={onClose} title="Filtros">
      <div className="space-y-5 font-mono">
        {/* Periodo */}
        <section>
          <h3 className="text-mono10 text-dim uppercase tracking-widest mb-2">PERÍODO</h3>
          <div className="flex gap-1.5 flex-wrap">
            {PERIODS.map((p) => (
              <Chip
                key={p.key}
                active={draft.period === p.key}
                onClick={() => setDraft((d) => ({ ...d, period: p.key }))}
                label={p.label}
              />
            ))}
          </div>
        </section>

        {/* Tipo */}
        <section>
          <h3 className="text-mono10 text-dim uppercase tracking-widest mb-2">TIPO</h3>
          <div className="flex gap-1.5 flex-wrap">
            {KINDS.map((k) => (
              <Chip
                key={k.key}
                active={draft.kinds.includes(k.key)}
                onClick={() => toggleKind(k.key)}
                label={k.label}
              />
            ))}
          </div>
        </section>

        {/* Categorías */}
        <section>
          <h3 className="text-mono10 text-dim uppercase tracking-widest mb-2">CATEGORÍAS</h3>
          <div className="flex gap-1.5 flex-wrap">
            {(categories ?? []).map((c) => (
              <Chip
                key={c.id}
                active={c.id ? draft.categoryIds.includes(c.id) : false}
                onClick={() => c.id && toggleCategory(c.id)}
                label={c.name}
                color={c.color}
              />
            ))}
          </div>
        </section>

        {/* Importe */}
        <section>
          <h3 className="text-mono10 text-dim uppercase tracking-widest mb-2">IMPORTE</h3>
          <div className="flex gap-2">
            <AmountInput
              value={draft.minAmount}
              placeholder="min"
              onChange={(v) => setDraft((d) => ({ ...d, minAmount: v }))}
              testId="filter-min"
            />
            <AmountInput
              value={draft.maxAmount}
              placeholder="max"
              onChange={(v) => setDraft((d) => ({ ...d, maxAmount: v }))}
              testId="filter-max"
            />
          </div>
        </section>

        {/* Footer */}
        <footer className="flex gap-2 pt-2">
          <Btn
            variant="outline"
            onClick={() => setDraft(EMPTY_FILTER)}
            block
            data-testid="filter-reset"
          >
            RESET
          </Btn>
          <Btn
            variant="solid"
            onClick={() => {
              current.set(draft);
              onClose();
            }}
            block
            data-testid="filter-apply"
          >
            APLICAR{count > 0 ? ` (${count})` : ''}
          </Btn>
        </footer>
      </div>
    </Sheet>
  );
}

function Chip({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1 px-2 py-1 rounded-xs border font-mono text-mono10 tracking-wider',
        active ? 'bg-surface text-accent border-accent' : 'bg-transparent text-muted border-border',
      ].join(' ')}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ background: color }} />}
      {label}
    </button>
  );
}

function AmountInput({
  value,
  placeholder,
  onChange,
  testId,
}: {
  value: number | null;
  placeholder: string;
  onChange: (v: number | null) => void;
  testId: string;
}) {
  return (
    <input
      type="number"
      inputMode="decimal"
      placeholder={placeholder}
      value={value == null ? '' : String(value)}
      onChange={(e) => {
        const v = e.target.value.trim();
        if (v === '') return onChange(null);
        const n = Number(v);
        onChange(Number.isFinite(n) ? n : null);
      }}
      data-testid={testId}
      className="flex-1 bg-transparent border border-border rounded-xs px-2 py-1.5 font-mono text-mono11 text-text focus:outline-none focus:border-borderStrong"
    />
  );
}
