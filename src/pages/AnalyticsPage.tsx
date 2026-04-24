/**
 * AnalyticsPage — F8 terminal-style analytics. Selector de rango, hero net
 * worth 12M con AreaChart, StackedBars IN_VS_OUT, top categories YoY y top
 * merchants. Heatmap anual (365 días) como banda final.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/database';
import { monthlyInOut, sumByKind, txByRange, expensesByCategory, txByMonth } from '@/db/queries';
import { formatMoney, formatMoneyCompact, shiftMonth } from '@/lib/format';
import { categoryYoy, runningNetSeries, topMerchants, type CategoryYoy } from '@/lib/analytics';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Section } from '@/ui/primitives';
import { AreaChart, HeatmapCal, StackedBars } from '@/ui/charts';
import { useApp } from '@/stores/app';

interface Props {
  onBack: () => void;
}

export function AnalyticsPage({ onBack }: Props) {
  const month = useApp((s) => s.month);

  const totals = useLiveQuery(() => sumByKind(month), [month]);
  const trend = useLiveQuery(() => monthlyInOut(month, 12), [month]);

  // Year range — last 12 months full window for runningNet and heatmap.
  const rangeStart = shiftMonth(month, -11);
  const rangeRows = useLiveQuery(() => txByRange(rangeStart, month), [rangeStart, month]);

  // YoY: current month vs the same month a year ago.
  const prevYearMonth = shiftMonth(month, -12);
  const prevRows = useLiveQuery(() => txByMonth(prevYearMonth), [prevYearMonth]);
  const curRows = useLiveQuery(() => txByMonth(month), [month]);

  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const catById = useMemo(() => {
    const m = new Map<number, string>();
    (categories ?? []).forEach((c) => c.id && m.set(c.id, c.name));
    return m;
  }, [categories]);

  const yoy: CategoryYoy[] = useMemo(
    () => categoryYoy(curRows ?? [], prevRows ?? []).slice(0, 6),
    [curRows, prevRows],
  );

  const merchants = useMemo(() => topMerchants(rangeRows ?? [], 6), [rangeRows]);

  const netSeries = useMemo(() => runningNetSeries(rangeRows ?? []), [rangeRows]);
  const expByCat = useLiveQuery(() => expensesByCategory(month), [month]);
  void expByCat; // currently unused directly; reserved for future drill-downs.

  const heatmap = useMemo(() => {
    // Build a ~365-day heatmap from the rows grouped by date (oldest first).
    const map = new Map<string, number>();
    for (const t of rangeRows ?? []) {
      if (t.kind !== 'expense') continue;
      map.set(t.date, (map.get(t.date) ?? 0) + (t.personalAmount ?? t.amount));
    }
    const days: number[] = [];
    const end = new Date();
    for (let i = 364; i >= 0; i--) {
      const d = new Date(end);
      d.setDate(end.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push(map.get(iso) ?? 0);
    }
    return days;
  }, [rangeRows]);

  return (
    <>
      <TopBarV2 title="analytics" sub={`${rangeStart} → ${month}`} onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="analytics-page">
        {/* HERO: running net */}
        <section className="px-3.5 py-4 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
            RUNNING_NET · 12M
          </div>
          <div className="font-mono text-[24px] tabular text-text mt-1">
            {totals ? formatMoney(totals.net) : '—'}
          </div>
          <div className="mt-2">
            <AreaChart
              data={netSeries}
              w={340}
              h={70}
              color="var(--color-accent)"
              fill="rgba(143,192,136,.1)"
              grid="var(--color-border)"
            />
          </div>
        </section>

        {/* IN vs OUT stacked */}
        <Section title="IN_VS_OUT · 12M">
          <StackedBars
            data={(trend ?? []).map((t) => ({ in: t.income, out: t.expense }))}
            w={340}
            h={80}
            inColor="var(--color-accent)"
            outColor="var(--color-danger)"
            grid="var(--color-border)"
          />
          <div className="mt-1 flex justify-between font-mono text-[8.5px] text-dim">
            {(trend ?? [])
              .filter((_, i) => i % 3 === 0)
              .map((t) => (
                <span key={t.month}>{t.month.slice(5)}</span>
              ))}
          </div>
        </Section>

        {/* Top categories YoY */}
        <Section title="TOP_CATEGORIES · YoY">
          <ul className="font-mono text-[11px]">
            {yoy.map((c) => {
              const name = catById.get(c.categoryId) ?? '—';
              const arrow = c.deltaPct >= 0 ? '▲' : '▼';
              const color = c.deltaPct >= 0 ? 'text-danger' : 'text-accent';
              return (
                <li
                  key={c.categoryId}
                  className="grid grid-cols-[1fr_auto_48px] gap-2 py-1.5 border-b border-border last:border-b-0"
                >
                  <span className="text-text truncate">{name.toUpperCase()}</span>
                  <span className="text-text tabular">{formatMoney(c.current)}</span>
                  <span className={`${color} tabular text-right`}>
                    {arrow} {Math.round(Math.abs(c.deltaPct) * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Top merchants */}
        <Section title="TOP_MERCHANTS · 12M">
          <ul className="font-mono text-[11px]">
            {merchants.map((m) => (
              <li
                key={m.merchant}
                className="grid grid-cols-[1fr_auto_48px] gap-2 py-1.5 border-b border-border last:border-b-0"
              >
                <span className="text-text truncate">{m.merchant}</span>
                <span className="text-text tabular">{formatMoney(m.total)}</span>
                <span className="text-dim tabular text-right">n={m.count}</span>
              </li>
            ))}
          </ul>
        </Section>

        {/* Year heatmap */}
        <Section title="YEAR_HEATMAP">
          <HeatmapCal
            data={heatmap}
            w={340}
            h={70}
            cols={28}
            color="var(--color-accent)"
            empty="var(--color-surface)"
          />
          <p className="mt-1 font-mono text-mono9 text-dim">
            365 días · gasto diario · pico {formatMoneyCompact(Math.max(0, ...heatmap))}
          </p>
        </Section>
      </div>
    </>
  );
}
