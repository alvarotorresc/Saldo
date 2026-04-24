/**
 * NetWorthPage — F7 terminal-style net worth. Single-user adaptation of the
 * handoff: hero net worth + Assets (cash + saved goals) + Liabilities (loans).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { sumByKind } from '@/db/queries';
import { formatMoney } from '@/lib/format';
import { netWorth } from '@/lib/netWorth';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Section } from '@/ui/primitives';
import { useApp } from '@/stores/app';

interface Props {
  onBack: () => void;
}

export function NetWorthPage({ onBack }: Props) {
  const month = useApp((s) => s.month);
  const totals = useLiveQuery(() => sumByKind(month), [month]);
  const goals = useLiveQuery(() => db.goals.toArray(), []);
  const loans = useLiveQuery(() => db.loans.toArray(), []);

  const cash = Math.max(0, totals?.net ?? 0);
  const breakdown = netWorth(cash, goals ?? [], loans ?? []);
  const positive = breakdown.netWorth >= 0;

  return (
    <>
      <TopBarV2 title="net_worth" sub={month} onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="net-worth-page">
        {/* HERO */}
        <section className="px-3.5 py-5 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
            NET_WORTH · {month}
          </div>
          <div
            className="font-mono text-[36px] leading-none tabular mt-1"
            style={{ color: positive ? 'var(--color-accent)' : 'var(--color-danger)' }}
            data-testid="nw-total"
          >
            {positive ? '+' : '−'}
            {formatMoney(Math.abs(breakdown.netWorth))}
          </div>
          <div className="mt-1 font-mono text-mono10 text-muted">
            assets <span className="text-accent">+{formatMoney(breakdown.assets)}</span> · liab{' '}
            <span className="text-danger">−{formatMoney(breakdown.liabilities)}</span>
          </div>
        </section>

        <Section title="ASSETS">
          <ul className="font-mono text-[11px]">
            <LineItem
              color="var(--color-accent)"
              label="CASH_NET"
              value={`+${formatMoney(breakdown.cashBalance)}`}
            />
            <LineItem
              color="#10B981"
              label="SAVED_GOALS"
              value={`+${formatMoney(breakdown.savedGoals)}`}
            />
            {(goals ?? []).map((g) => (
              <LineItem
                key={g.id}
                color={g.color}
                label={g.name.toUpperCase()}
                value={`+${formatMoney(g.saved)}`}
                sub={`target ${formatMoney(g.target)}${g.deadline ? ` · ${g.deadline}` : ''}`}
              />
            ))}
          </ul>
        </Section>

        <Section title="LIABILITIES">
          <ul className="font-mono text-[11px]">
            {(loans ?? []).length === 0 && (
              <li className="py-2 text-dim">Sin préstamos activos.</li>
            )}
            {(loans ?? []).map((l) => (
              <LineItem
                key={l.id}
                color={l.color ?? 'var(--color-danger)'}
                label={l.name.toUpperCase()}
                value={`−${formatMoney(l.principal)}`}
                sub={`${l.interestRate}% · ${l.termMonths}m`}
              />
            ))}
          </ul>
        </Section>
      </div>
    </>
  );
}

function LineItem({
  color,
  label,
  value,
  sub,
}: {
  color: string;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <li className="grid grid-cols-[12px_1fr_auto] items-center gap-2 py-2 border-b border-border last:border-b-0">
      <span className="w-2 h-2 rounded-full" style={{ background: color }} />
      <div className="min-w-0">
        <div className="text-text truncate">{label}</div>
        {sub && <div className="text-dim text-mono9">{sub}</div>}
      </div>
      <span className="text-text tabular">{value}</span>
    </li>
  );
}
