import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo } from 'react';
import { db } from '@/db/database';
import { daysUntil, monthlyCostForCadence, amortize, monthsElapsed } from '@/lib/loan';
import { effectiveAmount } from '@/db/queries';
import { formatDateLong, formatMoney } from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Icon } from '@/ui/Icon';
import { Money } from '@/ui/Money';

interface Props {
  onBack: () => void;
}

interface ForecastItem {
  date: string;
  description: string;
  amount: number;
  kind: 'expense' | 'income';
  source: 'subscription' | 'recurring' | 'loan';
}

export function ForecastPage({ onBack }: Props) {
  const subs = useLiveQuery(() => db.subscriptions.toArray(), []);
  const recurring = useLiveQuery(() => db.recurring.toArray(), []);
  const loans = useLiveQuery(() => db.loans.toArray(), []);
  const recentTxs = useLiveQuery(
    () => db.transactions.orderBy('date').reverse().limit(500).toArray(),
    [],
  );

  const items = useMemo<ForecastItem[]>(() => {
    const out: ForecastItem[] = [];
    // Subscriptions
    for (const s of subs ?? []) {
      if (!s.active) continue;
      const d = daysUntil(s.nextCharge);
      if (d < 0 || d > 60) continue;
      out.push({
        date: s.nextCharge,
        description: s.name,
        amount: s.amount,
        kind: 'expense',
        source: 'subscription',
      });
    }
    // Recurring expenses (that are not already subscriptions by signature)
    const subSigs = new Set((subs ?? []).map((s) => s.detectedSignature).filter(Boolean));
    for (const r of recurring ?? []) {
      if (subSigs.has(r.signature)) continue;
      const [ly, lm, ld] = r.lastSeen.split('-').map(Number);
      const nextDate = new Date(ly, (lm ?? 1) - 1, ld ?? 1);
      nextDate.setDate(nextDate.getDate() + r.cadenceDays);
      const iso = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;
      const d = daysUntil(iso);
      if (d < 0 || d > 60) continue;
      out.push({
        date: iso,
        description: r.signature,
        amount: r.averageAmount,
        kind: r.kind,
        source: 'recurring',
      });
    }
    // Loan payments for next month
    for (const l of loans ?? []) {
      const a = amortize(l);
      const paidMonths = monthsElapsed(l.startDate);
      const nextIdx = paidMonths;
      const nextRow = a.rows[nextIdx];
      if (nextRow) {
        const d = daysUntil(nextRow.date);
        if (d >= 0 && d <= 60) {
          out.push({
            date: nextRow.date,
            description: `Cuota ${l.name}`,
            amount: nextRow.payment,
            kind: 'expense',
            source: 'loan',
          });
        }
      }
    }
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }, [subs, recurring, loans]);

  const next30 = items.filter((i) => daysUntil(i.date) <= 30);
  const totalExp = next30.filter((i) => i.kind === 'expense').reduce((s, i) => s + i.amount, 0);
  const totalInc = next30.filter((i) => i.kind === 'income').reduce((s, i) => s + i.amount, 0);
  const avgMonthlyExpense = useMemo(() => {
    if (!recentTxs || recentTxs.length === 0) return 0;
    const byMonth = new Map<string, number>();
    for (const t of recentTxs) {
      if (t.kind !== 'expense') continue;
      byMonth.set(t.month, (byMonth.get(t.month) ?? 0) + effectiveAmount(t));
    }
    const arr = [...byMonth.values()];
    if (arr.length === 0) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
  }, [recentTxs]);

  return (
    <>
      <TopBar
        title="Previsión 30 días"
        subtitle="Según recurrentes, suscripciones y préstamos"
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        <Card>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Saldrá</p>
              <p className="text-base font-semibold text-danger tabular mt-1">
                {formatMoney(totalExp)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Entrará</p>
              <p className="text-base font-semibold text-accent tabular mt-1">
                {formatMoney(totalInc)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted">Neto</p>
              <p
                className={`text-base font-semibold tabular mt-1 ${
                  totalInc - totalExp >= 0 ? 'text-accent' : 'text-danger'
                }`}
              >
                {formatMoney(totalInc - totalExp)}
              </p>
            </div>
          </div>
          {avgMonthlyExpense > 0 && (
            <p className="text-[11px] text-muted mt-3 pt-3 border-t border-border">
              Gasto medio mensual observado:{' '}
              <span className="text-text tabular">{formatMoney(avgMonthlyExpense)}</span>
            </p>
          )}
        </Card>

        <Card padded={false}>
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Próximos 30 días</h3>
          </div>
          {next30.length === 0 ? (
            <p className="px-4 pb-4 text-sm text-muted">
              Nada previsto. Añade suscripciones, préstamos o deja que importes extractos para ver
              tus recurrentes.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {next30.map((it, i) => {
                const d = daysUntil(it.date);
                const label =
                  it.source === 'subscription'
                    ? 'Suscripción'
                    : it.source === 'loan'
                      ? 'Préstamo'
                      : 'Recurrente';
                const iconColor =
                  it.source === 'subscription'
                    ? '#818CF8'
                    : it.source === 'loan'
                      ? '#F59E0B'
                      : '#60A5FA';
                const iconName =
                  it.source === 'subscription'
                    ? 'repeat'
                    : it.source === 'loan'
                      ? 'bank'
                      : 'calendar';
                return (
                  <li key={i} className="px-4 py-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full grid place-items-center shrink-0"
                      style={{ background: iconColor + '22', color: iconColor }}
                    >
                      <Icon name={iconName} size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate capitalize">{it.description}</p>
                      <p className="text-[11px] text-muted">
                        {label} · {d === 0 ? 'hoy' : `en ${d} ${d === 1 ? 'día' : 'días'}`} ·{' '}
                        {formatDateLong(it.date)}
                      </p>
                    </div>
                    <Money
                      value={it.amount}
                      kind={it.kind}
                      signed
                      className="text-sm font-medium"
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
