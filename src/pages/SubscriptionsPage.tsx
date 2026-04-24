/**
 * SubscriptionsPage — F10 rewrite (ScrSubscriptions). Summary mensual/anual +
 * listas Próximos (30d) y Anuales. CRUD completo con color-bar vertical.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { formatMoney } from '@/lib/format';
import { monthlyCostForCadence, daysUntil, nextDateFromCadence } from '@/lib/loan';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import type { Subscription, SubscriptionCadence } from '@/types';

interface Props {
  onBack: () => void;
}

const PALETTE = [
  '#e50914',
  '#1db954',
  '#8b9dc3',
  '#10a37f',
  '#d97757',
  '#a78bd0',
  '#74a7c9',
  '#F472B6',
];
const CADENCES: SubscriptionCadence[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'];

export function SubscriptionsPage({ onBack }: Props) {
  const subs = useLiveQuery(() => db.subscriptions.where('active').equals(1).toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);

  const { monthly, yearly, upcoming, annuals } = useMemo(() => {
    let m = 0;
    let y = 0;
    const upcoming: Subscription[] = [];
    const annuals: Subscription[] = [];
    for (const s of subs ?? []) {
      const mc = monthlyCostForCadence(s.amount, s.cadence);
      m += mc;
      y += mc * 12;
      const d = daysUntil(s.nextCharge);
      if (s.cadence === 'yearly') annuals.push(s);
      else if (d >= 0 && d <= 30) upcoming.push(s);
    }
    upcoming.sort((a, b) => daysUntil(a.nextCharge) - daysUntil(b.nextCharge));
    annuals.sort((a, b) => daysUntil(a.nextCharge) - daysUntil(b.nextCharge));
    return { monthly: m, yearly: y, upcoming, annuals };
  }, [subs]);

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub={`SUBS · ${subs?.length ?? 0}`}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Nueva suscripción"
            className="press text-accent"
            data-testid="sub-add-btn"
          >
            <Icon name="plus" size={14} />
          </button>
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="subs-page">
        {/* Summary */}
        <div className="grid grid-cols-2 border-b border-border">
          <div className="px-3.5 py-3.5 border-r border-border">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">MENSUAL</div>
            <div className="font-mono text-[20px] tabular text-text mt-1">
              {formatMoney(monthly)}
            </div>
            <div className="font-mono text-mono9 text-muted mt-0.5">
              × 12 = {formatMoney(monthly * 12)}/año
            </div>
          </div>
          <div className="px-3.5 py-3.5">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">ANUAL_EQ</div>
            <div className="font-mono text-[20px] tabular text-text mt-1">
              {formatMoney(yearly)}
            </div>
            <div className="font-mono text-mono9 text-muted mt-0.5">
              = {formatMoney(yearly / 12)}/mes equiv.
            </div>
          </div>
        </div>

        {upcoming.length > 0 && (
          <>
            <div className="px-3.5 py-2.5 bg-surface border-b border-border font-mono text-mono9 text-dim tracking-widest uppercase">
              PRÓXIMOS COBROS · 30D
            </div>
            <ul>
              {upcoming.map((s) => (
                <li key={s.id} data-testid={`sub-${s.id}`}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-border press text-left"
                  >
                    <span className="w-1 h-7 shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-mono12 text-text truncate">{s.name}</div>
                      <div className="font-mono text-mono9 text-dim mt-0.5">
                        próximo: {s.nextCharge} · /{s.cadence}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-mono text-mono12 text-text tabular">
                        {formatMoney(s.amount)}
                      </div>
                      <div className="font-mono text-mono9 text-accent mt-0.5">activa</div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {annuals.length > 0 && (
          <>
            <div className="px-3.5 py-2.5 bg-surface border-y border-border font-mono text-mono9 text-dim tracking-widest uppercase">
              ANUALES
            </div>
            <ul>
              {annuals.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="w-full flex items-center gap-3 px-3.5 py-3 border-b border-border press text-left"
                  >
                    <span className="w-1 h-7 shrink-0" style={{ background: s.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-mono12 text-text truncate">{s.name}</div>
                      <div className="font-mono text-mono9 text-dim mt-0.5">
                        renueva {s.nextCharge}
                      </div>
                    </div>
                    <div className="font-mono text-mono12 text-text tabular">
                      {formatMoney(s.amount)}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {(subs ?? []).length === 0 && (
          <div className="px-3.5 py-6 font-mono text-mono10 text-dim text-center">
            Sin suscripciones. Añade la primera con +.
          </div>
        )}
      </div>

      <SubEditor open={addOpen} onClose={() => setAddOpen(false)} mode="create" />
      {editing && (
        <SubEditor
          open={!!editing}
          onClose={() => setEditing(null)}
          mode="edit"
          subscription={editing}
        />
      )}
    </>
  );
}

function SubEditor({
  open,
  onClose,
  mode,
  subscription,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  subscription?: Subscription;
}) {
  const [name, setName] = useState(subscription?.name ?? '');
  const [amount, setAmount] = useState(String(subscription?.amount ?? ''));
  const [cadence, setCadence] = useState<SubscriptionCadence>(subscription?.cadence ?? 'monthly');
  const [nextCharge, setNextCharge] = useState(
    subscription?.nextCharge ?? new Date().toISOString().slice(0, 10),
  );
  const [color, setColor] = useState(subscription?.color ?? PALETTE[0]);

  useEffect(() => {
    setName(subscription?.name ?? '');
    setAmount(String(subscription?.amount ?? ''));
    setCadence(subscription?.cadence ?? 'monthly');
    setNextCharge(subscription?.nextCharge ?? new Date().toISOString().slice(0, 10));
    setColor(subscription?.color ?? PALETTE[0]);
  }, [subscription?.id]);

  async function commit() {
    const n = name.trim();
    const a = Number(amount);
    if (!n || !Number.isFinite(a) || a <= 0) return;
    if (mode === 'create') {
      await db.subscriptions.add({
        name: n,
        amount: a,
        currency: 'EUR',
        cadence,
        nextCharge,
        startDate: nextCharge,
        color,
        active: 1,
        createdAt: Date.now(),
      });
    } else if (subscription?.id) {
      await db.subscriptions.update(subscription.id, {
        name: n,
        amount: a,
        cadence,
        nextCharge,
        color,
      });
    }
    onClose();
  }

  async function remove() {
    if (!subscription?.id) return;
    if (!window.confirm(`¿Borrar "${subscription.name}"?`)) return;
    await db.subscriptions.delete(subscription.id);
    onClose();
  }

  async function markPaid() {
    if (!subscription?.id) return;
    const next = nextDateFromCadence(nextCharge, cadence);
    await db.subscriptions.update(subscription.id, { nextCharge: next });
    setNextCharge(next);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nueva suscripción' : (subscription?.name ?? 'Editar suscripción')}
    >
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="sub-name-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">AMOUNT · €</span>
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">NEXT</span>
            <input
              type="date"
              value={nextCharge}
              onChange={(e) => setNextCharge(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
        </div>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">CADENCE</span>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {CADENCES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCadence(c)}
                aria-pressed={cadence === c}
                className={[
                  'py-1.5 border rounded-xs text-mono9 tracking-widest',
                  cadence === c
                    ? 'text-accent bg-surface border-accent'
                    : 'text-muted border-border',
                ].join(' ')}
              >
                {c.slice(0, 3).toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="text-mono9 text-dim uppercase tracking-widest">COLOR</span>
          <div className="mt-1 flex gap-1.5 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                className={[
                  'w-7 h-7 rounded-xs border',
                  color === c ? 'border-accent' : 'border-border',
                ].join(' ')}
                style={{ background: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <Btn variant="solid" block onClick={commit} disabled={!name.trim() || !amount}>
            {mode === 'create' ? 'CREATE' : 'SAVE'}
          </Btn>
          {mode === 'edit' && (
            <>
              <Btn variant="outline" onClick={markPaid}>
                NEXT+1
              </Btn>
              <Btn variant="danger" onClick={remove}>
                DELETE
              </Btn>
            </>
          )}
        </div>
      </div>
    </Sheet>
  );
}
