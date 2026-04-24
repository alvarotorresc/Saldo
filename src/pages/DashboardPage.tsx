/**
 * DashboardPage — Dashboard "Sobrio" for Saldo v0.2 (F3).
 * Visual direction: Terminal / Technical.
 * The Charts render mode (F4) is not implemented yet; the CHARTS|SOBRIO toggle
 * still persists the user choice so rehydration works across lock/unlock.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { dailySpend, expensesByGroup, sumByKind, txByMonth, effectiveAmount } from '@/db/queries';
import { formatMoney, formatMoneyCompact, shiftMonth, currentMonth } from '@/lib/format';
import { useTweenedNumber } from '@/lib/tween';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Badge } from '@/ui/primitives';
import { Spark, StackBar } from '@/ui/charts';
import { useApp } from '@/stores/app';
import { useMeta, type DashboardMode } from '@/stores/meta';
import type { Category, CategoryGroup, Transaction } from '@/types';

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

  const mode = useMeta((s) => s.dashboardMode);
  const hydrated = useMeta((s) => s.hydrated);
  const setMode = useMeta((s) => s.setDashboardMode);
  const hydrate = useMeta((s) => s.hydrate);
  useEffect(() => {
    if (!hydrated) void hydrate();
  }, [hydrated, hydrate]);

  const totals = useLiveQuery(() => sumByKind(month), [month]);
  const totalsPrev = useLiveQuery(() => sumByKind(prevMonth), [prevMonth]);
  const txs = useLiveQuery(() => txByMonth(month), [month]);
  const daily = useLiveQuery(() => dailySpend(month), [month]);
  const expByGroup = useLiveQuery(() => expensesByGroup(month), [month]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);

  const income = totals?.income ?? 0;
  const expense = totals?.expense ?? 0;
  const net = totals?.net ?? 0;
  const prevNet = totalsPrev?.net ?? 0;
  const deltaNet = net - prevNet;
  const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : 0;
  const txCount = txs?.length ?? 0;

  const tweenedNet = useTweenedNumber(net, 700);

  const catById = useMemo(() => {
    const m = new Map<number, Category>();
    (categories ?? []).forEach((c) => c.id && m.set(c.id, c));
    return m;
  }, [categories]);
  const groupById = useMemo(() => {
    const m = new Map<number, CategoryGroup>();
    (groups ?? []).forEach((g) => g.id && m.set(g.id, g));
    return m;
  }, [groups]);

  const topGroups = useMemo(() => {
    const arr: { id: number; amount: number; count: number }[] = [];
    expByGroup?.forEach((amt, key) => {
      if (typeof key === 'number') arr.push({ id: key, amount: amt, count: 0 });
    });
    // Back-fill per-group tx count from the month slice (cheap: O(n)).
    const gidByCat = new Map<number, number>();
    (categories ?? []).forEach((c) => c.id && c.groupId && gidByCat.set(c.id, c.groupId));
    for (const t of txs ?? []) {
      if (t.kind !== 'expense' || !t.categoryId) continue;
      const gid = gidByCat.get(t.categoryId);
      if (gid == null) continue;
      const bucket = arr.find((x) => x.id === gid);
      if (bucket) bucket.count += 1;
    }
    return arr.sort((a, b) => b.amount - a.amount).slice(0, 5);
  }, [expByGroup, categories, txs]);

  const recentTx: Transaction[] = (txs ?? []).slice(0, 6);
  const sparkData = daily ?? [];

  const nowMonth = currentMonth();
  const nextMonthDisabled = month >= nowMonth;

  const toggle = (
    <div
      role="group"
      aria-label="Dashboard render mode"
      className="flex items-center gap-[2px] p-[2px] border border-border rounded-xs"
    >
      <ModeButton
        active={mode === 'charts'}
        label="CHARTS"
        icon="chart"
        onClick={() => void setMode('charts' as DashboardMode)}
      />
      <ModeButton
        active={mode === 'sobrio'}
        label="SOBRIO"
        icon="list"
        onClick={() => void setMode('sobrio' as DashboardMode)}
      />
    </div>
  );

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub={`DASHBOARD · ${month}`}
        right={
          <>
            {toggle}
            <Badge tone="ok">
              <Icon name="lock" size={8} stroke={2} />
              LOCAL
            </Badge>
          </>
        }
      />

      <div className="scroll-area flex-1 pb-6">
        {/* Month switcher row (terminal style) */}
        <div className="flex items-center justify-between px-3.5 py-2 border-b border-border">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMonth(shiftMonth(month, -1))}
              className="p-1 text-muted press"
              aria-label="Mes anterior"
            >
              <Icon name="chev-l" size={14} />
            </button>
            <span className="font-mono text-mono10 text-dim tracking-wider">{month}</span>
            <button
              type="button"
              onClick={() => {
                if (!nextMonthDisabled) setMonth(shiftMonth(month, 1));
              }}
              aria-disabled={nextMonthDisabled}
              aria-label="Mes siguiente"
              className={`p-1 ${nextMonthDisabled ? 'text-dim opacity-40 cursor-not-allowed' : 'text-muted press'}`}
            >
              <Icon name="chev-r" size={14} />
            </button>
          </div>
          <span className="font-mono text-mono9 text-dim tracking-widest uppercase">
            {mode === 'charts' ? 'MODE=CHARTS · PENDING_F4' : 'MODE=SOBRIO'}
          </span>
        </div>

        {/* HERO */}
        <section className="px-3.5 py-[18px] border-b border-border">
          <div className="flex justify-between font-mono text-mono9 text-muted tracking-widest mb-2.5">
            <span>NET_BALANCE · {month}</span>
            <span>{month}</span>
          </div>
          <div
            className="font-mono text-[40px] leading-none tracking-tight tabular"
            style={{ color: net >= 0 ? 'var(--color-accent)' : 'var(--color-danger)' }}
            data-testid="hero-net"
          >
            {net >= 0 ? '+' : '−'}
            {formatMoneyCompact(Math.abs(tweenedNet))}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2.5 font-mono text-[11px]">
            <HeroMetric label="SAVE_RATE" value={`${savingsRate.toFixed(1)}`} unit="%" />
            <HeroMetric
              label="Δ PREV"
              value={`${deltaNet >= 0 ? '+' : '−'}${formatMoneyCompact(Math.abs(deltaNet))}`}
              valueClassName={deltaNet >= 0 ? 'text-accent' : 'text-danger'}
            />
            <HeroMetric label="TX" value={String(txCount)} />
          </div>

          <div className="mt-3.5 flex items-center gap-2.5">
            <span className="font-mono text-mono9 text-dim tracking-widest">30D</span>
            <div className="flex-1 text-accent">
              <Spark
                data={sparkData}
                w={240}
                h={26}
                color="var(--color-accent)"
                fill="rgba(143,192,136,.08)"
              />
            </div>
          </div>
        </section>

        {/* IN / OUT row */}
        <div className="grid grid-cols-2 border-b border-border">
          <div className="px-3.5 py-3 border-r border-border">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">INCOME</div>
            <div className="font-mono text-sans14 text-text mt-1 tabular">
              <span className="text-accent">+</span>
              {formatMoney(income)}
            </div>
          </div>
          <div className="px-3.5 py-3">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">EXPENSE</div>
            <div className="font-mono text-sans14 text-text mt-1 tabular">
              <span className="text-danger">−</span>
              {formatMoney(expense)}
            </div>
          </div>
        </div>

        {/* StackBar IN vs OUT */}
        {(income > 0 || expense > 0) && (
          <div className="px-3.5 py-3 border-b border-border">
            <div className="flex justify-between font-mono text-mono9 text-dim tracking-widest uppercase mb-1.5">
              <span>IN_OUT_SPLIT</span>
              <span>
                IN {income + expense > 0 ? Math.round((income / (income + expense)) * 100) : 0}%
              </span>
            </div>
            <StackBar
              h={6}
              data={[
                { color: 'var(--color-accent)', value: income },
                { color: 'var(--color-danger)', value: expense },
              ]}
            />
          </div>
        )}

        {/* Category breakdown */}
        {topGroups.length > 0 && (
          <section className="px-3.5 pt-3.5 pb-2.5 border-b border-border">
            <header className="flex justify-between items-baseline mb-2.5">
              <h2 className="font-mono text-mono10 text-muted uppercase tracking-widest">
                CATEGORY_BREAKDOWN
              </h2>
              <button
                type="button"
                onClick={onGoCharts}
                className="font-mono text-mono9 text-dim tracking-widest uppercase press"
              >
                DETAIL →
              </button>
            </header>
            <ul className="space-y-2">
              {topGroups.map((g) => {
                const grp = groupById.get(g.id);
                if (!grp) return null;
                const pct = expense > 0 ? (g.amount / expense) * 100 : 0;
                return (
                  <li key={g.id}>
                    <div className="flex justify-between font-mono text-[11px] mb-1">
                      <span className="text-text truncate">
                        <span className="mr-1.5" style={{ color: grp.color }}>
                          ■
                        </span>
                        {grp.name.toUpperCase()}
                        <span className="text-dim ml-2">n={g.count}</span>
                      </span>
                      <span className="text-text tabular shrink-0">
                        {formatMoney(g.amount)} <span className="text-dim">{pct.toFixed(1)}%</span>
                      </span>
                    </div>
                    <div className="h-[2px] bg-surface overflow-hidden">
                      <div
                        className="h-full"
                        style={{ width: `${pct}%`, background: grp.color, opacity: 0.75 }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Recent tx */}
        {recentTx.length > 0 && (
          <section className="px-3.5 pt-3.5 pb-4 border-b border-border">
            <header className="flex justify-between items-baseline mb-2">
              <h2 className="font-mono text-mono10 text-muted uppercase tracking-widest">
                RECENT_TX
              </h2>
              <button
                type="button"
                onClick={onGoTransactions}
                className="font-mono text-mono9 text-dim tracking-widest uppercase press"
              >
                LEDGER →
              </button>
            </header>
            <ul className="font-mono text-[11px]">
              {recentTx.map((t) => {
                const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                const isIncome = t.kind === 'income';
                const amt = isIncome ? t.amount : effectiveAmount(t);
                return (
                  <li
                    key={t.id}
                    className="grid grid-cols-[48px_1fr_auto] gap-2.5 py-1.5 border-b border-border last:border-b-0"
                  >
                    <span className="text-dim">{t.date.slice(5)}</span>
                    <span className="text-text truncate">
                      {t.merchant ?? t.description}
                      {cat && <span className="text-dim ml-1.5">· {cat.name}</span>}
                    </span>
                    <span
                      className={`${isIncome ? 'text-accent' : 'text-text'} tabular whitespace-nowrap`}
                    >
                      {isIncome ? '+' : '−'}
                      {formatMoney(amt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Quick actions */}
        <section className="px-3.5 pt-3.5 pb-4">
          <h2 className="font-mono text-mono10 text-muted uppercase tracking-widest mb-2.5">
            QUICK_ACTIONS
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <QuickActionChip icon="import" label="IMPORT" onClick={onGoImport} />
            <QuickActionChip icon="plus" label="NEW_TX" onClick={onGoTransactions} />
            <QuickActionChip icon="repeat" label="SUBS" onClick={onGoSubscriptions} />
            <QuickActionChip icon="chart" label="CHARTS" onClick={onGoCharts} />
          </div>
        </section>
      </div>
    </>
  );
}

function HeroMetric({
  label,
  value,
  unit,
  valueClassName = 'text-text',
}: {
  label: string;
  value: string;
  unit?: string;
  valueClassName?: string;
}) {
  return (
    <div>
      <div className="font-mono text-[9px] text-dim uppercase tracking-widest">{label}</div>
      <div className={`font-mono text-[13px] mt-1 tabular ${valueClassName}`}>
        {value}
        {unit && <span className="text-muted">{unit}</span>}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: 'chart' | 'list';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        'inline-flex items-center gap-1 px-1.5 py-[3px] rounded-xs font-mono text-mono9 tracking-widest',
        active ? 'bg-surface text-accent' : 'bg-transparent text-dim',
      ].join(' ')}
    >
      <Icon name={icon} size={9} stroke={2} />
      {label}
    </button>
  );
}

function QuickActionChip({
  icon,
  label,
  onClick,
}: {
  icon: 'import' | 'plus' | 'repeat' | 'chart';
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 border border-border rounded-xs px-3 py-2.5 press font-mono text-mono10 text-muted uppercase tracking-widest"
    >
      <Icon name={icon} size={12} stroke={1.8} className="text-dim" />
      <span>{label}</span>
    </button>
  );
}
