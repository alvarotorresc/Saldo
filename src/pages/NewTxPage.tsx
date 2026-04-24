/**
 * NewTxPage — F5 terminal-style transaction creator. Segmented EXPENSE/INCOME/
 * TRANSFER + calculator amount input + category picker + shared toggle.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { draftToTransaction, parseAmountInput, validateDraft, type NewTxDraft } from '@/lib/newTx';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import type { TxKind } from '@/types';

interface Props {
  onBack: () => void;
  onCommitted: (txId: number) => void;
  initialKind?: TxKind;
}

const KINDS: { key: TxKind; label: string; color: string }[] = [
  { key: 'expense', label: 'EXPENSE', color: 'var(--color-danger)' },
  { key: 'income', label: 'INCOME', color: 'var(--color-accent)' },
  { key: 'transfer', label: 'TRANSFER', color: 'var(--color-muted)' },
];

export function NewTxPage({ onBack, onCommitted, initialKind = 'expense' }: Props) {
  const [kind, setKind] = useState<TxKind>(initialKind);
  const [rawAmount, setRawAmount] = useState('0');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [shared, setShared] = useState(false);
  const [personalRaw, setPersonalRaw] = useState('');
  const [categoryOpen, setCategoryOpen] = useState(false);

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const categoriesForKind = useMemo(
    () => (categories ?? []).filter((c) => c.kind === kind || kind === 'transfer'),
    [categories, kind],
  );

  const amount = parseAmountInput(rawAmount);
  const personalAmount = shared && personalRaw ? parseAmountInput(personalRaw) : undefined;
  const draft: NewTxDraft = {
    kind,
    amount,
    date,
    description,
    merchant: merchant || undefined,
    categoryId,
    personalAmount,
    accountId: accounts?.[0]?.id ?? 1,
  };
  const errors = validateDraft(draft);

  async function commit() {
    if (errors.length > 0) return;
    const payload = draftToTransaction(draft);
    const id = (await db.transactions.add(payload)) as number;
    onCommitted(id);
  }

  const selectedCategory = categoriesForKind.find((c) => c.id === categoryId);

  return (
    <>
      <TopBarV2 title="new_tx" sub={date} onBack={onBack} />
      <div className="scroll-area flex-1 pb-6">
        {/* Segmented kind */}
        <div
          role="radiogroup"
          aria-label="Tipo de movimiento"
          className="grid grid-cols-3 border-b border-border"
        >
          {KINDS.map((k) => (
            <button
              key={k.key}
              type="button"
              role="radio"
              aria-checked={kind === k.key}
              onClick={() => setKind(k.key)}
              className={[
                'py-2.5 font-mono text-mono10 tracking-widest border-b press',
                kind === k.key
                  ? 'text-accent border-accent bg-surface'
                  : 'text-muted border-transparent',
              ].join(' ')}
              data-testid={`kind-${k.key}`}
            >
              {k.label}
            </button>
          ))}
        </div>

        {/* Amount */}
        <section className="px-3.5 py-5 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
            AMOUNT · EUR
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={rawAmount}
              onChange={(e) => setRawAmount(e.target.value)}
              className="bg-transparent font-mono text-[38px] tabular text-text focus:outline-none w-full"
              style={{ caretColor: 'var(--color-accent)' }}
              data-testid="amount-input"
            />
          </div>
          {Number.isNaN(amount) && (
            <div className="mt-1 font-mono text-mono9 text-warning">invalid amount</div>
          )}
        </section>

        <RowLink icon="file" label="DESCRIPTION" value={description || 'add…'} onClick={undefined}>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mercadona, factura, cena…"
            data-testid="desc-input"
            className="bg-transparent w-full font-mono text-mono11 text-text focus:outline-none"
          />
        </RowLink>

        <RowLink icon="tag" label="MERCHANT" value={merchant || '—'}>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            placeholder="opcional"
            className="bg-transparent w-full font-mono text-mono11 text-text focus:outline-none"
          />
        </RowLink>

        <button
          type="button"
          onClick={() => setCategoryOpen(true)}
          data-testid="category-row"
          className="flex items-center justify-between w-full px-3.5 py-2.5 border-b border-border press"
        >
          <span className="flex items-center gap-2.5 min-w-0">
            <Icon name="grid" size={14} className="text-muted shrink-0" />
            <span className="font-mono text-mono10 text-dim tracking-wider uppercase">
              CATEGORY
            </span>
            <span className="font-mono text-mono11 text-text truncate">
              {selectedCategory?.name ?? 'sin categoría'}
            </span>
          </span>
          <Icon name="chev-r" size={12} className="text-dim" />
        </button>

        <div className="px-3.5 py-2.5 border-b border-border flex items-center justify-between">
          <span className="flex items-center gap-2.5">
            <Icon name="users" size={14} className="text-muted" />
            <span className="font-mono text-mono10 text-dim tracking-wider uppercase">SHARED</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={shared}
            onClick={() => setShared((s) => !s)}
            data-testid="shared-toggle"
            className={[
              'w-10 h-5 rounded-full border',
              shared ? 'bg-accent border-accent' : 'bg-transparent border-border',
            ].join(' ')}
          >
            <span
              className={[
                'block w-4 h-4 rounded-full bg-bg border border-border transition-transform',
                shared ? 'translate-x-[20px]' : 'translate-x-[2px]',
              ].join(' ')}
            />
          </button>
        </div>
        {shared && (
          <div className="px-3.5 py-2.5 border-b border-border">
            <label className="font-mono text-mono9 text-dim tracking-widest uppercase">
              MY_SHARE · EUR
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={personalRaw}
              onChange={(e) => setPersonalRaw(e.target.value)}
              data-testid="personal-input"
              className="mt-1 bg-transparent w-full font-mono text-mono12 text-text border-b border-border focus:outline-none focus:border-borderStrong"
            />
          </div>
        )}

        <div className="px-3.5 py-4">
          <Btn
            variant="solid"
            block
            onClick={commit}
            disabled={errors.length > 0}
            data-testid="commit-btn"
          >
            COMMIT
          </Btn>
          {errors.length > 0 && (
            <ul className="mt-2 font-mono text-mono9 text-danger space-y-0.5">
              {errors.map((e, i) => (
                <li key={i}>
                  · {e.field}: {e.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Category picker sheet */}
      <Sheet open={categoryOpen} onClose={() => setCategoryOpen(false)} title="Elegir categoría">
        <ul className="divide-y divide-border">
          {categoriesForKind.map((c) => (
            <li
              key={c.id}
              onClick={() => {
                setCategoryId(c.id);
                setCategoryOpen(false);
              }}
              className="flex items-center gap-2 px-2 py-2.5 cursor-pointer press"
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: c.color }} />
              <span className="font-mono text-mono11 text-text">{c.name}</span>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function RowLink({
  icon,
  label,
  value,
  onClick,
  children,
}: {
  icon: 'file' | 'tag';
  label: string;
  value: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b border-border"
      onClick={onClick}
    >
      <span className="flex items-center gap-2.5 min-w-0">
        <Icon name={icon} size={14} className="text-muted shrink-0" />
        <span className="font-mono text-mono10 text-dim tracking-wider uppercase">{label}</span>
      </span>
      <span className="flex-1 text-right min-w-0">{children ?? value}</span>
    </div>
  );
}
