import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { effectiveAmount } from '@/db/queries';
import {
  formatMoney,
  formatMoneyCompact,
  formatMonth,
  formatMonthShort,
  shiftMonth,
  currentMonth,
} from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { EmptyState } from '@/ui/EmptyState';
import { LineChart } from '@/ui/charts/LineChart';
import { BarChart } from '@/ui/charts/BarChart';

interface Props {
  onBack: () => void;
}

type RangePreset = '3m' | '6m' | '12m' | 'all';

export function ChartsPage({ onBack }: Props) {
  const [preset, setPreset] = useState<RangePreset>('6m');

  const months = useMemo(() => {
    const now = currentMonth();
    const count = preset === '3m' ? 3 : preset === '6m' ? 6 : preset === '12m' ? 12 : 24;
    const list: string[] = [];
    for (let i = count - 1; i >= 0; i--) list.push(shiftMonth(now, -i));
    return list;
  }, [preset]);

  const txs = useLiveQuery(
    () =>
      db.transactions
        .where('month')
        .between(months[0], months[months.length - 1], true, true)
        .toArray(),
    [preset],
  );
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const byMonth = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>();
    months.forEach((m) => map.set(m, { income: 0, expense: 0 }));
    for (const t of txs ?? []) {
      const m = map.get(t.month);
      if (!m) continue;
      if (t.kind === 'income') {
        if (t.reimbursementFor) continue;
        m.income += t.amount;
      } else if (t.kind === 'expense') {
        m.expense += effectiveAmount(t);
      }
    }
    return map;
  }, [txs, months]);

  const savingsSeries = useMemo(
    () =>
      months.map((m) => {
        const v = byMonth.get(m) ?? { income: 0, expense: 0 };
        return { x: formatMonthShort(m), y: v.income - v.expense };
      }),
    [months, byMonth],
  );

  const cumulativeSeries = useMemo(() => {
    let acc = 0;
    return months.map((m) => {
      const v = byMonth.get(m) ?? { income: 0, expense: 0 };
      acc += v.income - v.expense;
      return { x: formatMonthShort(m), y: acc };
    });
  }, [months, byMonth]);

  const incomeExpenseBars = useMemo(
    () =>
      months.map((m) => {
        const v = byMonth.get(m) ?? { income: 0, expense: 0 };
        return { label: formatMonthShort(m), income: v.income, expense: v.expense };
      }),
    [months, byMonth],
  );

  const categoryBars = useMemo(() => {
    const mapC = new Map<number, number>();
    const catsById = new Map<number, { name: string; color: string }>();
    (categories ?? []).forEach((c) => c.id && catsById.set(c.id, { name: c.name, color: c.color }));
    for (const t of txs ?? []) {
      if (t.kind !== 'expense') continue;
      if (!t.categoryId) continue;
      mapC.set(t.categoryId, (mapC.get(t.categoryId) ?? 0) + effectiveAmount(t));
    }
    return [...mapC.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([id, expense]) => ({
        label: catsById.get(id)?.name.slice(0, 6) ?? '—',
        expense,
        color: catsById.get(id)?.color ?? '#F87171',
      }));
  }, [txs, categories]);

  const totalIncome = [...byMonth.values()].reduce((s, v) => s + v.income, 0);
  const totalExpense = [...byMonth.values()].reduce((s, v) => s + v.expense, 0);
  const totalNet = totalIncome - totalExpense;

  if (!txs) {
    return <div className="p-6 text-sm text-muted">Cargando...</div>;
  }

  if (txs.length === 0) {
    return (
      <>
        <TopBar
          title="Gráficas"
          leading={
            <button onClick={onBack} className="press text-muted" aria-label="Atrás">
              <Icon name="chevron-left" />
            </button>
          }
        />
        <EmptyState
          title="Sin datos"
          description="Importa movimientos o añade alguno para ver gráficas."
        />
      </>
    );
  }

  return (
    <>
      <TopBar
        title="Gráficas"
        subtitle={`${formatMonth(months[0])} – ${formatMonth(months[months.length - 1])}`}
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        <SegmentedControl
          value={preset}
          onChange={setPreset}
          options={[
            { value: '3m', label: '3M' },
            { value: '6m', label: '6M' },
            { value: '12m', label: '1A' },
            { value: 'all', label: '2A' },
          ]}
        />

        <div className="grid grid-cols-3 gap-2">
          <Card padded={false} className="p-3">
            <p className="text-[10px] text-muted uppercase tracking-wider">Ingresos</p>
            <p className="text-base font-semibold tabular text-accent mt-1">
              {formatMoneyCompact(totalIncome)}
            </p>
          </Card>
          <Card padded={false} className="p-3">
            <p className="text-[10px] text-muted uppercase tracking-wider">Gastos</p>
            <p className="text-base font-semibold tabular text-danger mt-1">
              {formatMoneyCompact(totalExpense)}
            </p>
          </Card>
          <Card padded={false} className="p-3">
            <p className="text-[10px] text-muted uppercase tracking-wider">Ahorro</p>
            <p
              className={`text-base font-semibold tabular mt-1 ${
                totalNet >= 0 ? 'text-accent' : 'text-danger'
              }`}
            >
              {formatMoneyCompact(totalNet)}
            </p>
          </Card>
        </div>

        <Card>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold">Ingresos vs Gastos</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-accent" />
                <span className="text-muted">Ingreso</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-danger" />
                <span className="text-muted">Gasto</span>
              </span>
            </div>
          </div>
          <BarChart items={incomeExpenseBars} formatY={(n) => formatMoneyCompact(n)} />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-2">Ahorro mensual</h3>
          <LineChart
            series={[
              {
                label: 'Ahorro',
                values: savingsSeries,
                color: '#10B981',
                fill: true,
              },
            ]}
            formatY={(n) => formatMoneyCompact(n)}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-2">Ahorro acumulado</h3>
          <LineChart
            series={[
              {
                label: 'Acumulado',
                values: cumulativeSeries,
                color: '#60A5FA',
                fill: true,
              },
            ]}
            formatY={(n) => formatMoneyCompact(n)}
          />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold mb-2">Top categorías (rango)</h3>
          <BarChart items={categoryBars} mode="single" formatY={(n) => formatMoneyCompact(n)} />
          <ul className="mt-3 space-y-1.5">
            {categoryBars.map((c, i) => (
              <li key={i} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                  <span className="text-muted">{c.label}</span>
                </span>
                <span className="tabular">{formatMoney(c.expense ?? 0)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
