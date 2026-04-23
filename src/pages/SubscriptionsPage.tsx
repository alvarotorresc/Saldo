import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { daysUntil, monthlyCostForCadence, nextDateFromCadence } from '@/lib/loan';
import { formatDateLong, formatMoney } from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input, Select, Textarea } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import type { Subscription, SubscriptionCadence } from '@/types';

const COLORS = ['#818CF8', '#60A5FA', '#A78BFA', '#F472B6', '#10B981', '#F59E0B', '#FB7185'];

interface Props {
  onBack: () => void;
}

export function SubscriptionsPage({ onBack }: Props) {
  const subs = useLiveQuery(() => db.subscriptions.orderBy('nextCharge').toArray(), []);
  const recurring = useLiveQuery(() => db.recurring.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const [detectOpen, setDetectOpen] = useState(false);

  const totals = useMemo(() => {
    let monthly = 0;
    let yearly = 0;
    for (const s of subs ?? []) {
      if (!s.active) continue;
      monthly += monthlyCostForCadence(s.amount, s.cadence);
      yearly += monthlyCostForCadence(s.amount, s.cadence) * 12;
    }
    return { monthly, yearly };
  }, [subs]);

  return (
    <>
      <TopBar
        title="Suscripciones"
        subtitle={`${formatMoney(totals.monthly)}/mes · ${formatMoney(totals.yearly)}/año`}
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
        trailing={
          <>
            {(recurring?.filter((r) => r.kind === 'expense').length ?? 0) > 0 && (
              <button
                onClick={() => setDetectOpen(true)}
                className="press w-9 h-9 rounded-full bg-elevated border border-border grid place-items-center text-muted"
                aria-label="Detectar desde recurrentes"
                title="Detectar desde recurrentes"
              >
                <Icon name="repeat" />
              </button>
            )}
            <button
              onClick={() => setAddOpen(true)}
              className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
              aria-label="Nueva suscripción"
            >
              <Icon name="plus" />
            </button>
          </>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-3">
        {!subs || subs.length === 0 ? (
          <EmptyState
            title="Sin suscripciones"
            description="Añade Netflix, Spotify, gimnasio... o deja que Saldo las detecte desde tus gastos recurrentes."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                Añadir suscripción
              </Button>
            }
          />
        ) : (
          subs.map((s) => {
            const days = daysUntil(s.nextCharge);
            const urgency = days <= 2 ? 'text-danger' : days <= 7 ? 'text-warning' : 'text-muted';
            const monthly = monthlyCostForCadence(s.amount, s.cadence);
            return (
              <Card key={s.id} padded={false}>
                <button onClick={() => setEditing(s)} className="press w-full text-left p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-10 h-10 rounded-full grid place-items-center shrink-0 text-sm font-semibold"
                      style={{ background: s.color + '22', color: s.color }}
                    >
                      {s.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold truncate">{s.name}</p>
                        <span className="text-sm tabular">
                          {formatMoney(s.amount)}
                          <span className="text-muted text-[10px] ml-1">
                            /{cadenceAbbrev(s.cadence)}
                          </span>
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className={`text-[11px] tabular ${urgency}`}>
                          {days < 0
                            ? `hace ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`
                            : days === 0
                              ? 'Hoy'
                              : `en ${days} ${days === 1 ? 'día' : 'días'}`}
                          <span className="text-dim"> · {formatDateLong(s.nextCharge)}</span>
                        </p>
                        {s.cadence !== 'monthly' && (
                          <p className="text-[11px] text-muted tabular">
                            ≈{formatMoney(monthly)}/mes
                          </p>
                        )}
                      </div>
                      {s.notes && <p className="text-[11px] text-dim mt-1 truncate">{s.notes}</p>}
                    </div>
                  </div>
                </button>
              </Card>
            );
          })
        )}
      </div>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Nueva suscripción">
        <SubForm categories={categories ?? []} onClose={() => setAddOpen(false)} />
      </Sheet>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Editar suscripción">
        {editing && (
          <SubForm sub={editing} categories={categories ?? []} onClose={() => setEditing(null)} />
        )}
      </Sheet>

      <Sheet open={detectOpen} onClose={() => setDetectOpen(false)} title="Recurrentes detectados">
        <DetectRecurring
          recurringExpenses={(recurring ?? []).filter((r) => r.kind === 'expense')}
          existing={subs ?? []}
          onClose={() => setDetectOpen(false)}
        />
      </Sheet>
    </>
  );
}

function cadenceAbbrev(c: SubscriptionCadence): string {
  return { weekly: 'sem', biweekly: 'quinc', monthly: 'mes', quarterly: 'trim', yearly: 'año' }[c];
}

function hashSignature(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function SubForm({
  sub,
  categories,
  onClose,
}: {
  sub?: Subscription;
  categories: { id?: number; name: string; kind: string }[];
  onClose: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(sub?.name ?? '');
  const [amount, setAmount] = useState(sub ? String(sub.amount) : '');
  const [cadence, setCadence] = useState<SubscriptionCadence>(sub?.cadence ?? 'monthly');
  const [startDate, setStartDate] = useState(sub?.startDate ?? today);
  const [nextCharge, setNextCharge] = useState(sub?.nextCharge ?? today);
  const [categoryId, setCategoryId] = useState<number>(sub?.categoryId ?? 0);
  const [color, setColor] = useState(sub?.color ?? COLORS[0]);
  const [notes, setNotes] = useState(sub?.notes ?? '');
  const [active, setActive] = useState(sub?.active ?? 1);

  async function save() {
    const a = Number(amount);
    if (!name || !Number.isFinite(a) || a <= 0) return;
    const base: Omit<Subscription, 'id' | 'createdAt'> = {
      name,
      amount: a,
      currency: 'EUR',
      cadence,
      startDate,
      nextCharge,
      categoryId: categoryId || undefined,
      color,
      notes: notes || undefined,
      active: (active ? 1 : 0) as 0 | 1,
    };
    if (sub?.id) {
      await db.subscriptions.update(sub.id, base);
    } else {
      await db.subscriptions.add({ ...base, createdAt: Date.now() });
    }
    onClose();
  }

  async function remove() {
    if (!sub?.id) return;
    if (!window.confirm('¿Eliminar esta suscripción? No se puede deshacer.')) return;
    await db.subscriptions.delete(sub.id);
    onClose();
  }

  function autoNext() {
    setNextCharge(nextDateFromCadence(startDate, cadence));
  }

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Netflix"
        autoFocus={!sub}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Importe (€)"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Select
          label="Cadencia"
          value={cadence}
          onChange={(e) => setCadence(e.target.value as SubscriptionCadence)}
        >
          <option value="weekly">Semanal</option>
          <option value="biweekly">Quincenal</option>
          <option value="monthly">Mensual</option>
          <option value="quarterly">Trimestral</option>
          <option value="yearly">Anual</option>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Inicio"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="Próximo cobro"
          type="date"
          value={nextCharge}
          onChange={(e) => setNextCharge(e.target.value)}
        />
      </div>
      <button onClick={autoNext} className="press text-xs text-info flex items-center gap-1">
        <Icon name="calendar" size={14} /> Calcular próximo cobro desde inicio + cadencia
      </button>
      <Select
        label="Categoría"
        value={categoryId}
        onChange={(e) => setCategoryId(Number(e.target.value))}
      >
        <option value={0}>Sin categoría</option>
        {categories
          .filter((c) => c.kind === 'expense')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <div>
        <p className="block text-xs text-muted mb-1.5">Color</p>
        <div className="flex gap-2 flex-wrap">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-8 h-8 rounded-full press ${color === c ? 'ring-2 ring-text/70' : ''}`}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
      <Textarea
        label="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Opcional"
      />
      <label className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-elevated border border-border">
        <span className="text-sm">Activa</span>
        <input
          type="checkbox"
          checked={!!active}
          onChange={(e) => setActive(e.target.checked ? 1 : 0)}
          className="w-5 h-5 accent-accent"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
      {sub?.id && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar
        </Button>
      )}
    </div>
  );
}

function DetectRecurring({
  recurringExpenses,
  existing,
  onClose,
}: {
  recurringExpenses: {
    id?: number;
    signature: string;
    averageAmount: number;
    cadenceDays: number;
    lastSeen: string;
    categoryId?: number;
  }[];
  existing: Subscription[];
  onClose: () => void;
}) {
  const existingSigs = new Set(existing.map((s) => s.detectedSignature).filter(Boolean));
  const candidates = recurringExpenses.filter((r) => !existingSigs.has(r.signature));

  async function add(r: (typeof recurringExpenses)[number]) {
    const cadence: SubscriptionCadence =
      r.cadenceDays <= 10
        ? 'weekly'
        : r.cadenceDays <= 20
          ? 'biweekly'
          : r.cadenceDays <= 40
            ? 'monthly'
            : r.cadenceDays <= 100
              ? 'quarterly'
              : 'yearly';
    const nextCharge = nextDateFromCadence(r.lastSeen, cadence);
    const colorIdx = hashSignature(r.signature) % COLORS.length;
    await db.subscriptions.add({
      name: r.signature.replace(/\b\w/g, (c) => c.toUpperCase()),
      amount: r.averageAmount,
      currency: 'EUR',
      cadence,
      startDate: r.lastSeen,
      nextCharge,
      categoryId: r.categoryId,
      color: COLORS[colorIdx],
      active: 1,
      detectedSignature: r.signature,
      createdAt: Date.now(),
    });
  }

  if (candidates.length === 0) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          No hay recurrentes nuevos por añadir. Todos ya están como suscripción o aún no se han
          detectado.
        </p>
        <Button full variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted">Gastos recurrentes detectados. Añade los que quieras.</p>
      <ul className="divide-y divide-border border border-border rounded-xl">
        {candidates.map((r) => (
          <li key={r.id} className="p-3 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm truncate capitalize">{r.signature}</p>
              <p className="text-[11px] text-muted">
                ~{r.cadenceDays} días · {formatMoney(r.averageAmount)}
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                await add(r);
              }}
            >
              Añadir
            </Button>
          </li>
        ))}
      </ul>
      <Button full variant="secondary" onClick={onClose}>
        Cerrar
      </Button>
    </div>
  );
}
