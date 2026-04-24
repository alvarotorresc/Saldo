import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { expensesByGroup, sumByKind, txByMonth, effectiveAmount } from '@/db/queries';
import { formatMoney, formatMoneyCompact, shiftMonth } from '@/lib/format';
import { daysUntil, monthlyCostForCadence } from '@/lib/loan';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Money } from '@/ui/Money';
import { MonthSwitcher } from '@/ui/MonthSwitcher';
import { Icon } from '@/ui/Icon';
import { useApp } from '@/stores/app';
import { EmptyState } from '@/ui/EmptyState';
import { Button } from '@/ui/Button';
import { FAB } from '@/ui/FAB';
import { Sheet } from '@/ui/Sheet';
import { TxForm } from '@/features/transactions/TxForm';
import type { Category, CategoryGroup } from '@/types';

interface Props {
  onGoImport: () => void;
  onGoTransactions: () => void;
  onGoSubscriptions: () => void;
  onGoCharts: () => void;
}

export function DashboardPage({
  onGoImport,
  onGoTransactions,
  onGoSubscriptions,
  onGoCharts,
}: Props) {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const prevMonth = shiftMonth(month, -1);
  const [addOpen, setAddOpen] = useState(false);

  const totals = useLiveQuery(() => sumByKind(month), [month]);
  const totalsPrev = useLiveQuery(() => sumByKind(prevMonth), [prevMonth]);
  const txs = useLiveQuery(() => txByMonth(month).then((r) => r.slice(0, 6)), [month]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);
  const budgets = useLiveQuery(
    () => db.budgets.where('month').anyOf([month, '*']).toArray(),
    [month],
  );
  const expByGroup = useLiveQuery(() => expensesByGroup(month), [month]);
  const subs = useLiveQuery(() => db.subscriptions.where('active').equals(1).toArray(), []);

  const catById = useMemo(() => {
    const map = new Map<number, Category>();
    (categories ?? []).forEach((c) => c.id && map.set(c.id, c));
    return map;
  }, [categories]);
  const groupById = useMemo(() => {
    const map = new Map<number, CategoryGroup>();
    (groups ?? []).forEach((g) => g.id && map.set(g.id, g));
    return map;
  }, [groups]);

  const topGroups = useMemo(() => {
    const arr: { id: number; amount: number }[] = [];
    expByGroup?.forEach((amt, key) => {
      if (typeof key === 'number') arr.push({ id: key, amount: amt });
    });
    return arr.sort((a, b) => b.amount - a.amount);
  }, [expByGroup]);

  const totalExpense = totals?.expense ?? 0;
  const totalIncome = totals?.income ?? 0;
  const net = totals?.net ?? 0;
  const prevNet = totalsPrev?.net ?? 0;
  const savingsRate = totalIncome > 0 ? Math.max(0, Math.round((net / totalIncome) * 100)) : 0;
  const deltaNet = net - prevNet;
  const maxGroup = topGroups[0]?.amount ?? 1;

  const nextSubs = useMemo(() => {
    const arr = (subs ?? [])
      .map((s) => ({ s, d: daysUntil(s.nextCharge) }))
      .filter((x) => x.d >= 0 && x.d <= 14)
      .sort((a, b) => a.d - b.d)
      .slice(0, 3);
    return arr;
  }, [subs]);

  const monthlySubsCost = useMemo(() => {
    let s = 0;
    for (const sub of subs ?? []) s += monthlyCostForCadence(sub.amount, sub.cadence);
    return s;
  }, [subs]);

  const isEmpty = totalIncome === 0 && totalExpense === 0;

  return (
    <>
      <TopBar title="Saldo" subtitle="Tu dinero, bajo control" />
      <div className="scroll-area flex-1 pb-28 px-4 space-y-4">
        <MonthSwitcher month={month} onChange={setMonth} />

        {isEmpty ? (
          <EmptyState
            title="Aún no hay datos de este mes"
            description="Importa un extracto CSV de N26 o BBVA, o añade un movimiento manual."
            action={
              <div className="flex gap-2 flex-wrap justify-center">
                <Button variant="primary" onClick={onGoImport}>
                  Importar extracto
                </Button>
                <Button variant="secondary" onClick={() => setAddOpen(true)}>
                  Añadir manual
                </Button>
              </div>
            }
          />
        ) : (
          <>
            {/* Hero card */}
            <Card className="relative overflow-hidden">
              <div
                aria-hidden
                className="absolute -top-16 -right-16 w-48 h-48 rounded-full blur-3xl opacity-20"
                style={{
                  background: net >= 0 ? '#10B981' : '#F87171',
                }}
              />
              <div className="relative">
                <p className="text-xs text-muted uppercase tracking-wider">Ahorrado este mes</p>
                <div className="mt-1 text-4xl font-semibold tabular">
                  <Money value={net} kind={net >= 0 ? 'income' : 'expense'} signed />
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs">
                    {deltaNet >= 0 ? (
                      <Icon name="trending-up" size={14} className="text-accent" />
                    ) : (
                      <Icon name="trending-down" size={14} className="text-danger" />
                    )}
                    <span className="text-muted">
                      {deltaNet >= 0 ? '+' : ''}
                      {formatMoneyCompact(deltaNet)} vs mes anterior
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-muted">Tasa ahorro</span>
                    <span className="tabular font-semibold">{savingsRate}%</span>
                  </div>
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-elevated overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${Math.min(100, Math.max(0, savingsRate))}%`,
                      background: net >= 0 ? '#10B981' : '#F87171',
                    }}
                  />
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-accent/15 text-accent grid place-items-center">
                    <Icon name="trending-up" size={14} />
                  </span>
                  <p className="text-xs text-muted uppercase tracking-wider">Ingresos</p>
                </div>
                <div className="mt-2 text-xl font-semibold">
                  <Money value={totalIncome} kind="income" />
                </div>
              </Card>
              <Card className="relative overflow-hidden">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-full bg-danger/15 text-danger grid place-items-center">
                    <Icon name="trending-down" size={14} />
                  </span>
                  <p className="text-xs text-muted uppercase tracking-wider">Gastos</p>
                </div>
                <div className="mt-2 text-xl font-semibold">
                  <Money value={totalExpense} kind="expense" />
                </div>
              </Card>
            </div>

            {topGroups.length > 0 && (
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold">Gasto por grupo</h3>
                  <button
                    onClick={onGoCharts}
                    className="text-[11px] text-muted press flex items-center gap-0.5"
                  >
                    Gráficas <Icon name="chevron-right" size={12} />
                  </button>
                </div>
                <div className="space-y-3">
                  {topGroups.map((g) => {
                    const grp = groupById.get(g.id);
                    if (!grp) return null;
                    const pct = Math.min(100, Math.round((g.amount / maxGroup) * 100));
                    const pctOfTotal =
                      totalExpense > 0 ? Math.round((g.amount / totalExpense) * 100) : 0;
                    return (
                      <div key={g.id}>
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ background: grp.color }}
                            />
                            <span className="truncate">{grp.name}</span>
                            <span className="text-[11px] text-dim tabular">{pctOfTotal}%</span>
                          </div>
                          <span className="tabular text-text">{formatMoney(g.amount)}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: grp.color, opacity: 0.9 }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {budgets && budgets.length > 0 && (
              <BudgetSummary budgets={budgets} categories={categories ?? []} month={month} />
            )}

            {nextSubs.length > 0 && (
              <Card padded={false}>
                <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">Próximas suscripciones</h3>
                    <p className="text-[11px] text-muted">
                      {formatMoney(monthlySubsCost)}/mes en total
                    </p>
                  </div>
                  <button
                    onClick={onGoSubscriptions}
                    className="text-[11px] text-muted press flex items-center gap-0.5"
                  >
                    Ver todas <Icon name="chevron-right" size={12} />
                  </button>
                </div>
                <ul className="divide-y divide-border">
                  {nextSubs.map(({ s, d }) => (
                    <li key={s.id} className="px-4 py-3 flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full grid place-items-center shrink-0 text-xs font-semibold"
                        style={{ background: s.color + '22', color: s.color }}
                      >
                        {s.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm truncate">{s.name}</p>
                        <p className="text-[11px] text-muted">
                          {d === 0 ? 'Hoy' : `En ${d} ${d === 1 ? 'día' : 'días'}`}
                        </p>
                      </div>
                      <Money value={s.amount} kind="expense" className="text-sm" />
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {txs && txs.length > 0 && (
              <Card padded={false}>
                <div className="flex items-center justify-between px-4 pt-4 pb-2">
                  <h3 className="text-sm font-semibold">Últimos movimientos</h3>
                  <button
                    onClick={onGoTransactions}
                    className="text-[11px] text-muted press flex items-center gap-0.5"
                  >
                    Ver todos <Icon name="chevron-right" size={12} />
                  </button>
                </div>
                <ul className="divide-y divide-border">
                  {txs.map((t) => {
                    const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                    const shared = t.personalAmount != null;
                    return (
                      <li key={t.id} className="px-4 py-3 flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full grid place-items-center shrink-0 text-[13px] font-semibold"
                          style={{
                            background: (cat?.color ?? '#2A2A30') + '22',
                            color: cat?.color ?? '#8A8A93',
                          }}
                        >
                          {(t.merchant ?? t.description).slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate flex items-center gap-1.5">
                            {t.merchant ?? t.description}
                            {shared && <Icon name="users" size={13} className="text-info" />}
                          </p>
                          <p className="text-[11px] text-muted truncate">
                            {cat?.name ?? 'Sin categoría'}
                          </p>
                        </div>
                        <Money
                          value={shared ? effectiveAmount(t) : t.amount}
                          kind={t.kind === 'expense' ? 'expense' : 'income'}
                          signed
                          className="text-sm font-medium"
                        />
                      </li>
                    );
                  })}
                </ul>
              </Card>
            )}
          </>
        )}
      </div>

      <FAB icon={<Icon name="plus" size={22} />} label="Añadir" onClick={() => setAddOpen(true)} />

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Nuevo movimiento">
        <TxForm onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}

function BudgetSummary({
  budgets,
  categories,
  month,
}: {
  budgets: { id?: number; categoryId: number; amount: number }[];
  categories: Category[];
  month: string;
}) {
  const expenses = useLiveQuery(
    () =>
      db.transactions
        .where('month')
        .equals(month)
        .filter((t) => t.kind === 'expense')
        .toArray(),
    [month],
  );

  const byCat = useMemo(() => {
    const m = new Map<number, number>();
    for (const t of expenses ?? []) {
      if (!t.categoryId) continue;
      m.set(t.categoryId, (m.get(t.categoryId) ?? 0) + effectiveAmount(t));
    }
    return m;
  }, [expenses]);

  return (
    <Card>
      <h3 className="text-sm font-semibold mb-3">Presupuestos</h3>
      <div className="space-y-3">
        {budgets.map((b) => {
          const cat = categories.find((c) => c.id === b.categoryId);
          if (!cat) return null;
          const spent = byCat.get(b.categoryId) ?? 0;
          const pct = Math.min(100, Math.round((spent / Math.max(b.amount, 1)) * 100));
          const over = spent > b.amount;
          return (
            <div key={b.id}>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                  <span>{cat.name}</span>
                </div>
                <span className={`tabular ${over ? 'text-danger' : ''}`}>
                  {formatMoney(spent)} / {formatMoney(b.amount)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-elevated overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${pct}%`,
                    background: over ? '#F87171' : cat.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
