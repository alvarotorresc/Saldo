/**
 * LoansPage — F10 rewrite (ScrLoans). Hero DEUDA_TOTAL en danger + cuota
 * mensual agregada + lista de préstamos con barra de % pagado, TAE y
 * próxima cuota usando amortize() existente.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { formatMoney } from '@/lib/format';
import { amortize, monthsElapsed } from '@/lib/loan';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import type { Loan } from '@/types';

interface Props {
  onBack: () => void;
}

const PALETTE = ['#F87171', '#FB7185', '#F59E0B', '#FBBF24', '#A78BFA', '#60A5FA'];

interface LoanStats {
  loan: Loan;
  remaining: number;
  paid: number;
  pct: number; // 0..1
  monthly: number;
  nextPay: string;
}

export function LoansPage({ onBack }: Props) {
  const loans = useLiveQuery(() => db.loans.toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  const stats = useMemo<LoanStats[]>(() => {
    return (loans ?? []).map((l) => {
      const summary = amortize(l);
      const paidMonths = Math.min(summary.rows.length, monthsElapsed(l.startDate));
      const paidRow = paidMonths > 0 ? summary.rows[paidMonths - 1] : undefined;
      const remaining = paidRow?.balance ?? l.principal;
      const paid = Math.max(0, l.principal - remaining);
      const pct = l.principal > 0 ? paid / l.principal : 0;
      const nextRow = summary.rows[paidMonths] ?? summary.rows[summary.rows.length - 1];
      return {
        loan: l,
        remaining,
        paid,
        pct,
        monthly: summary.monthlyPayment,
        nextPay: nextRow?.date ?? '—',
      };
    });
  }, [loans]);

  const totalDebt = stats.reduce((s, x) => s + x.remaining, 0);
  const totalMonthly = stats.reduce((s, x) => s + x.monthly, 0);

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub={`LOANS · ${loans?.length ?? 0}`}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            aria-label="Nuevo préstamo"
            className="press text-accent"
            data-testid="loan-add-btn"
          >
            <Icon name="plus" size={14} />
          </button>
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="loans-page">
        <section className="px-3.5 py-3.5 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">DEUDA_TOTAL</div>
          <div className="font-mono text-[26px] tabular text-danger mt-1">
            −{formatMoney(totalDebt)}
          </div>
          <div className="font-mono text-mono11 text-muted mt-2">
            cuota mensual: <span className="text-text">{formatMoney(totalMonthly)}</span>
          </div>
        </section>

        {stats.map(({ loan, remaining, paid, pct, monthly, nextPay }) => (
          <section
            key={loan.id}
            className="px-3.5 py-3.5 border-b border-border"
            data-testid={`loan-${loan.id}`}
          >
            <button
              type="button"
              onClick={() => setEditing(loan)}
              className="w-full text-left press"
            >
              <div className="flex justify-between mb-2">
                <div className="min-w-0">
                  <div className="font-mono text-mono12 text-text truncate">{loan.name}</div>
                  <div className="font-mono text-mono9 text-dim mt-0.5">
                    TAE {loan.interestRate}% · próx. cuota {nextPay}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-mono text-mono12 text-text tabular">
                    {formatMoney(remaining)}
                  </div>
                  <div className="font-mono text-mono9 text-dim mt-0.5">
                    de {formatMoney(loan.principal)}
                  </div>
                </div>
              </div>
              <div className="h-[3px] bg-surface rounded-[1px] overflow-hidden">
                <div
                  className="h-full"
                  style={{
                    width: `${Math.min(100, pct * 100)}%`,
                    background: loan.color ?? 'var(--color-accent)',
                  }}
                />
              </div>
              <div className="flex justify-between mt-1.5 font-mono text-mono9 text-muted">
                <span>
                  {(pct * 100).toFixed(1)}% pagado ({formatMoney(paid)})
                </span>
                <span>{formatMoney(monthly)}/mes</span>
              </div>
            </button>
          </section>
        ))}

        {(loans ?? []).length === 0 && (
          <div className="px-3.5 py-6 font-mono text-mono10 text-dim text-center">
            Sin préstamos. Añade el primero con +.
          </div>
        )}
      </div>

      <LoanEditor open={addOpen} onClose={() => setAddOpen(false)} mode="create" />
      {editing && (
        <LoanEditor open={!!editing} onClose={() => setEditing(null)} mode="edit" loan={editing} />
      )}
    </>
  );
}

function LoanEditor({
  open,
  onClose,
  mode,
  loan,
}: {
  open: boolean;
  onClose: () => void;
  mode: 'create' | 'edit';
  loan?: Loan;
}) {
  const [name, setName] = useState(loan?.name ?? '');
  const [principal, setPrincipal] = useState(String(loan?.principal ?? ''));
  const [interestRate, setInterestRate] = useState(String(loan?.interestRate ?? '0'));
  const [termMonths, setTermMonths] = useState(String(loan?.termMonths ?? '60'));
  const [startDate, setStartDate] = useState(
    loan?.startDate ?? new Date().toISOString().slice(0, 10),
  );
  const [extra, setExtra] = useState(String(loan?.extraPayment ?? '0'));
  const [color, setColor] = useState(loan?.color ?? PALETTE[0]);

  useMemo(() => {
    setName(loan?.name ?? '');
    setPrincipal(String(loan?.principal ?? ''));
    setInterestRate(String(loan?.interestRate ?? '0'));
    setTermMonths(String(loan?.termMonths ?? '60'));
    setStartDate(loan?.startDate ?? new Date().toISOString().slice(0, 10));
    setExtra(String(loan?.extraPayment ?? '0'));
    setColor(loan?.color ?? PALETTE[0]);
  }, [loan?.id]);

  async function commit() {
    const n = name.trim();
    const p = Number(principal);
    const r = Number(interestRate);
    const m = Number(termMonths);
    const x = Number(extra);
    if (!n || !Number.isFinite(p) || p <= 0) return;
    if (!Number.isFinite(r) || r < 0) return;
    if (!Number.isFinite(m) || m <= 0) return;
    if (mode === 'create') {
      await db.loans.add({
        name: n,
        principal: p,
        interestRate: r,
        termMonths: m,
        startDate,
        extraPayment: Number.isFinite(x) && x > 0 ? x : undefined,
        color,
        createdAt: Date.now(),
      });
    } else if (loan?.id) {
      await db.loans.update(loan.id, {
        name: n,
        principal: p,
        interestRate: r,
        termMonths: m,
        startDate,
        extraPayment: Number.isFinite(x) && x > 0 ? x : undefined,
        color,
      });
    }
    onClose();
  }

  async function remove() {
    if (!loan?.id) return;
    if (!window.confirm(`¿Borrar préstamo "${loan.name}"?`)) return;
    await db.loans.delete(loan.id);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Nuevo préstamo' : (loan?.name ?? 'Editar préstamo')}
    >
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">NAME</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="loan-name-input"
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">PRINCIPAL · €</span>
            <input
              type="number"
              inputMode="decimal"
              value={principal}
              onChange={(e) => setPrincipal(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">TAE · %</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.01"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">TERM · meses</span>
            <input
              type="number"
              value={termMonths}
              onChange={(e) => setTermMonths(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
          <label>
            <span className="text-mono9 text-dim uppercase tracking-widest">START</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text focus:outline-none focus:border-borderStrong"
            />
          </label>
        </div>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">EXTRA · €/mes</span>
          <input
            type="number"
            inputMode="decimal"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
          />
        </label>
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
          <Btn variant="solid" block onClick={commit} disabled={!name.trim() || !principal}>
            {mode === 'create' ? 'CREATE' : 'SAVE'}
          </Btn>
          {mode === 'edit' && (
            <Btn variant="danger" onClick={remove}>
              DELETE
            </Btn>
          )}
        </div>
      </div>
    </Sheet>
  );
}
