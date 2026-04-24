/**
 * DashboardCharts — "Charts" render mode for the Saldo v0.2 Dashboard (F4).
 * Hero screen of the redesign: ring + AreaChart + 3-up sparklines + StackedBars
 * + Donut + Heatmap + budget mini-rings + single-account sparkline.
 *
 * Rendered by DashboardPage when useMeta.dashboardMode === 'charts'. The TopBar,
 * mode toggle and month switcher stay in DashboardPage for a consistent shell.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import {
  dailySpend,
  dailySpendSeries,
  expensesByCategory,
  expensesByGroup,
  monthlyInOut,
  sumByKind,
} from '@/db/queries';
import { formatMoney, formatMoneyCompact, currentMonth } from '@/lib/format';
import { collapseSmallSegments, rangeToDays, RANGE_KEYS, type RangeKey } from '@/lib/ranges';
import { AreaChart, Donut, HeatmapCal, Ring, Spark, StackedBars } from '@/ui/charts';
import { useApp } from '@/stores/app';
import type { CategoryGroup } from '@/types';

function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split('-').map(Number);
  if (!y || !m) return monthIso;
  const d = new Date(y, m, 0);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function DashboardCharts() {
  const month = useApp((s) => s.month);
  const endIso = month === currentMonth() ? todayIso() : lastDayOfMonth(month);
  const [range, setRange] = useState<RangeKey>('30D');
  const rangeDays = rangeToDays(range, endIso);

  const totals = useLiveQuery(() => sumByKind(month), [month]);
  const daily = useLiveQuery(() => dailySpend(month), [month]);
  const series = useLiveQuery(() => dailySpendSeries(endIso, rangeDays), [endIso, rangeDays]);
  const inOut12 = useLiveQuery(() => monthlyInOut(month, 12), [month]);
  const expByGroup = useLiveQuery(() => expensesByGroup(month), [month]);
  const expByCategory = useLiveQuery(() => expensesByCategory(month), [month]);
  const groups = useLiveQuery(() => db.categoryGroups.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const budgets = useLiveQuery(
    () => db.budgets.where('month').anyOf([month, '*']).toArray(),
    [month],
  );
  const mainAccount = useLiveQuery(() =>
    db.accounts
      .orderBy('id')
      .filter((a) => !a.archived)
      .first(),
  );

  const income = totals?.income ?? 0;
  const expense = totals?.expense ?? 0;
  const net = totals?.net ?? 0;
  const savingsRate = income > 0 ? Math.max(0, (net / income) * 100) : 0;
  const dayOfMonth = new Date().getDate();
  const dailyAvg = month === currentMonth() && dayOfMonth > 0 ? expense / dayOfMonth : expense / 30;
  const runway = dailyAvg > 0 ? Math.max(0, Math.floor(net / dailyAvg)) : 0;

  const sparkData = series ?? [];
  const monthDaily = daily ?? [];
  const today = monthDaily[new Date().getDate() - 1] ?? 0;
  const sparkWeek = sparkData.slice(-7);
  const sparkPrevWeek = sparkData.slice(-14, -7);
  const sparkMonth = monthDaily;
  const week = sparkWeek.reduce((s, v) => s + v, 0);
  const peak = sparkData.length > 0 ? Math.max(...sparkData) : 0;

  const groupById = useMemo(() => {
    const m = new Map<number, CategoryGroup>();
    (groups ?? []).forEach((g) => g.id && m.set(g.id, g));
    return m;
  }, [groups]);

  const donutSlices = useMemo(() => {
    const arr: { id: number; value: number; color: string; label: string }[] = [];
    expByGroup?.forEach((v, key) => {
      if (typeof key !== 'number') return;
      const g = groupById.get(key);
      if (!g) return;
      arr.push({ id: key, value: v, color: g.color, label: g.name });
    });
    return collapseSmallSegments(arr, 5);
  }, [expByGroup, groupById]);

  const trendData = useMemo(
    () => (inOut12 ?? []).map((m) => ({ in: m.income, out: m.expense })),
    [inOut12],
  );

  const catById = useMemo(() => {
    const m = new Map<number, { name: string; color: string }>();
    (categories ?? []).forEach((c) => c.id && m.set(c.id, { name: c.name, color: c.color }));
    return m;
  }, [categories]);

  const budgetRings = useMemo(() => {
    if (!budgets) return [];
    return budgets.slice(0, 4).map((b) => {
      const spent =
        (expByCategory && typeof b.categoryId === 'number' ? expByCategory.get(b.categoryId) : 0) ??
        0;
      const cat = catById.get(b.categoryId);
      return {
        id: b.id ?? b.categoryId,
        spent,
        limit: b.amount,
        color: cat?.color ?? 'var(--color-accent)',
        label: cat?.name ?? 'BUDGET',
      };
    });
  }, [budgets, expByCategory, catById]);

  const budgetsOkCount = (budgets ?? []).filter((b) => {
    const spent =
      (expByCategory && typeof b.categoryId === 'number' ? expByCategory.get(b.categoryId) : 0) ??
      0;
    return spent <= b.amount;
  }).length;

  const rangeLabels = (() => {
    // First and last dates of the current series window.
    if (sparkData.length === 0) return { start: '', end: endIso.slice(5) };
    const startMs = new Date(endIso + 'T00:00:00Z').getTime() - (rangeDays - 1) * 86400000;
    const startIso = new Date(startMs).toISOString().slice(5, 10);
    return { start: startIso, end: endIso.slice(5) };
  })();

  return (
    <div data-testid="dashboard-charts">
      {/* HERO: ring + NET */}
      <section className="px-3.5 py-4 border-b border-border">
        <div className="flex items-center gap-4">
          <Ring
            size={92}
            stroke={5}
            value={savingsRate}
            max={100}
            color="var(--color-accent)"
            track="var(--color-surface)"
          >
            <span className="font-mono text-[17px] text-accent tabular">
              {savingsRate.toFixed(0)}
              <span className="text-[10px] text-muted">%</span>
            </span>
            <span className="font-mono text-[8px] text-dim tracking-widest mt-[1px]">SAVED</span>
          </Ring>
          <div className="flex-1 min-w-0">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
              NET · {month}
            </div>
            <div
              className="font-mono text-[28px] tabular leading-[1.1] mt-0.5"
              style={{ color: net >= 0 ? 'var(--color-accent)' : 'var(--color-danger)' }}
              data-testid="hero-net"
            >
              {net >= 0 ? '+' : '−'}
              {formatMoneyCompact(Math.abs(net))}
            </div>
            <div className="mt-1.5 font-mono text-mono10 text-muted">
              runway <span className="text-text">{runway}d</span> · avg/día{' '}
              <span className="text-text">{formatMoney(dailyAvg)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Range selector */}
      <div
        role="tablist"
        aria-label="Rango de tiempo"
        className="flex gap-1 px-3.5 py-2 border-b border-border"
      >
        {RANGE_KEYS.map((r) => {
          const active = r === range;
          return (
            <button
              key={r}
              role="tab"
              aria-selected={active}
              onClick={() => setRange(r)}
              className={[
                'flex-1 py-[5px] text-center font-mono text-[9.5px] tracking-widest rounded-xs',
                active
                  ? 'bg-surface text-accent border-b border-accent'
                  : 'text-muted border-b border-transparent press',
              ].join(' ')}
              data-testid={`range-${r}`}
            >
              {r}
            </button>
          );
        })}
      </div>

      {/* Area chart */}
      <section className="px-3.5 pt-3.5 pb-3 border-b border-border">
        <div className="flex justify-between mb-2">
          <div>
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
              DAILY_SPEND · {range}
            </div>
            <div className="font-mono text-[17px] text-text tabular mt-0.5">
              {formatMoney(expense)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-mono9 text-dim tracking-widest uppercase">PEAK</div>
            <div className="font-mono text-[12px] text-danger mt-0.5">
              {formatMoneyCompact(peak)}
            </div>
          </div>
        </div>
        <AreaChart
          data={sparkData}
          w={340}
          h={85}
          color="var(--color-accent)"
          fill="rgba(143,192,136,.12)"
          grid="var(--color-border)"
        />
        <div className="flex justify-between mt-1.5 font-mono text-[8.5px] text-dim">
          <span>{rangeLabels.start}</span>
          <span>{rangeLabels.end}</span>
        </div>
      </section>

      {/* 3-up metrics */}
      <div className="grid grid-cols-3 border-b border-border">
        {[
          { label: 'HOY', value: today, chart: sparkWeek },
          {
            label: 'SEM',
            value: week,
            chart: sparkPrevWeek.length > 0 ? sparkPrevWeek : sparkWeek,
          },
          { label: 'MES', value: expense, chart: sparkMonth },
        ].map((m, i) => (
          <div
            key={m.label}
            className={`px-3.5 py-3 ${i < 2 ? 'border-r border-border' : ''}`}
            data-testid={`metric-${m.label}`}
          >
            <div className="font-mono text-[8.5px] text-dim uppercase tracking-widest">
              {m.label}
            </div>
            <div className="font-mono text-sans14 text-text tabular mt-1">
              {formatMoneyCompact(m.value)}
            </div>
            <div className="mt-1.5 text-accent/60">
              <Spark
                data={m.chart}
                w={80}
                h={16}
                color="var(--color-accent)"
                fill="rgba(143,192,136,.1)"
              />
            </div>
          </div>
        ))}
      </div>

      {/* IN vs OUT 12M */}
      <section className="px-3.5 pt-3.5 pb-3 border-b border-border">
        <div className="flex justify-between mb-2">
          <span className="font-mono text-mono9 text-dim tracking-widest uppercase">
            IN_VS_OUT · 12M
          </span>
          <span className="font-mono text-mono9 text-muted flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 bg-accent opacity-85" />
            IN
            <span className="inline-block w-1.5 h-1.5 bg-danger opacity-80 ml-2" />
            OUT
          </span>
        </div>
        <StackedBars
          data={trendData}
          w={340}
          h={90}
          inColor="var(--color-accent)"
          outColor="var(--color-danger)"
          grid="var(--color-border)"
        />
        <div className="flex justify-between mt-1 font-mono text-[8.5px] text-dim">
          {(inOut12 ?? [])
            .filter((_, i) => i % 3 === 0)
            .map((t) => (
              <span key={t.month}>{t.month.slice(5)}</span>
            ))}
        </div>
      </section>

      {/* Category donut */}
      {donutSlices.length > 0 && (
        <section className="px-3.5 pt-3.5 pb-3 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase mb-2.5">
            CATEGORY_SPLIT
          </div>
          <div className="flex items-center gap-3.5">
            <Donut size={104} stroke={14} data={donutSlices} track="var(--color-surface)" />
            <ul className="flex-1 min-w-0 space-y-0.5">
              {donutSlices.slice(0, 5).map((s) => {
                const total = donutSlices.reduce((acc, x) => acc + x.value, 0);
                const pct = total > 0 ? (s.value / total) * 100 : 0;
                return (
                  <li
                    key={String(s.id)}
                    className="flex justify-between font-mono text-[10px] py-0.5"
                  >
                    <span className="text-text truncate">
                      <span className="mr-1.5" style={{ color: s.color }}>
                        ■
                      </span>
                      {s.label}
                    </span>
                    <span className="text-muted shrink-0 ml-1.5">{pct.toFixed(1)}%</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      )}

      {/* Heatmap */}
      <section className="px-3.5 pt-3.5 pb-3 border-b border-border">
        <div className="flex justify-between mb-2.5">
          <span className="font-mono text-mono9 text-dim tracking-widest uppercase">
            SPEND_HEATMAP · {range}
          </span>
          <span className="font-mono text-mono9 text-muted flex items-center gap-0.5">
            <span className="text-dim">−</span>
            {[0.2, 0.4, 0.6, 0.8, 1].map((o) => (
              <span
                key={o}
                className="inline-block w-[7px] h-[7px] bg-accent rounded-[1px] ml-0.5"
                style={{ opacity: o }}
              />
            ))}
            <span className="text-dim ml-0.5">+</span>
          </span>
        </div>
        <HeatmapCal
          data={sparkData}
          w={340}
          h={38}
          color="var(--color-accent)"
          empty="var(--color-surface)"
        />
      </section>

      {/* Budgets */}
      {(budgets?.length ?? 0) > 0 && (
        <section className="px-3.5 pt-3.5 pb-3 border-b border-border">
          <div className="flex justify-between mb-2.5">
            <span className="font-mono text-mono9 text-dim tracking-widest uppercase">
              BUDGETS · {budgets?.length ?? 0} ACTIVE
            </span>
            <span className="font-mono text-mono9 text-accent">
              {budgetsOkCount}/{budgets?.length ?? 0} OK
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 gap-y-2.5">
            {budgetRings.map((b) => {
              const pct = b.limit > 0 ? Math.min(1, b.spent / b.limit) : 0;
              return (
                <div key={String(b.id)} className="flex items-center gap-2">
                  <Ring
                    size={38}
                    stroke={3}
                    value={pct * 100}
                    color={b.color}
                    track="var(--color-surface)"
                  >
                    <span className="font-mono text-[8.5px] text-text tabular">
                      {Math.round(pct * 100)}
                    </span>
                  </Ring>
                  <div className="min-w-0 flex-1">
                    <div className="font-mono text-[9.5px] text-text truncate">
                      {b.label.toUpperCase()}
                    </div>
                    <div className="font-mono text-[8.5px] text-muted mt-0.5">
                      {formatMoneyCompact(b.spent)}/{formatMoneyCompact(b.limit)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Single account (no multi-account per product rule) */}
      <section className="px-3.5 pt-3.5 pb-4">
        <div className="flex justify-between mb-2">
          <span className="font-mono text-mono9 text-dim tracking-widest uppercase">ACCOUNT</span>
          <span className="font-mono text-mono9 text-muted">
            NET Σ <span className="text-text">{formatMoneyCompact(net)}</span>
          </span>
        </div>
        <div
          className="grid items-center gap-2 py-[7px]"
          style={{ gridTemplateColumns: '1fr 70px auto' }}
        >
          <div className="min-w-0">
            <div className="font-mono text-[10px] text-text truncate">
              {(mainAccount?.name ?? 'CUENTA PRINCIPAL').toUpperCase()}
            </div>
            <div className="font-mono text-mono9 text-dim mt-0.5">
              {mainAccount?.bank ?? 'manual'}
            </div>
          </div>
          <div className="text-accent/60">
            <Spark data={sparkData} w={70} h={16} color="var(--color-accent)" />
          </div>
          <span className="font-mono text-[11px] text-text tabular text-right">
            {formatMoneyCompact(net)}
          </span>
        </div>
      </section>
    </div>
  );
}
