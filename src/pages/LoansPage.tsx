import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { amortize, monthsElapsed } from '@/lib/loan';
import { formatDateLong, formatMoney } from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input, Textarea } from '@/ui/Input';
import { EmptyState } from '@/ui/EmptyState';
import type { Loan } from '@/types';

const COLORS = ['#F59E0B', '#60A5FA', '#A78BFA', '#F472B6', '#10B981', '#FB7185'];

interface Props {
  onBack: () => void;
}

export function LoansPage({ onBack }: Props) {
  const loans = useLiveQuery(() => db.loans.toArray(), []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);
  const [viewing, setViewing] = useState<Loan | null>(null);

  const totalDebt = useMemo(() => {
    if (!loans) return 0;
    return loans.reduce((sum, l) => {
      const a = amortize(l);
      const paidMonths = monthsElapsed(l.startDate);
      const row = a.rows[Math.min(paidMonths, a.rows.length - 1)];
      return sum + (row?.balance ?? l.principal);
    }, 0);
  }, [loans]);

  return (
    <>
      <TopBar
        title="Préstamos"
        subtitle={
          loans && loans.length > 0
            ? `Pendiente aprox. ${formatMoney(totalDebt)}`
            : 'Tabla de amortización'
        }
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
        trailing={
          <button
            onClick={() => setAddOpen(true)}
            className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
            aria-label="Nuevo préstamo"
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-3">
        {!loans || loans.length === 0 ? (
          <EmptyState
            title="Sin préstamos"
            description="Añade un préstamo (coche, hipoteca, personal) y Saldo calcula la tabla de amortización francesa."
            action={
              <Button variant="primary" onClick={() => setAddOpen(true)}>
                Nuevo préstamo
              </Button>
            }
          />
        ) : (
          loans.map((l) => {
            const a = amortize(l);
            const paidMonths = monthsElapsed(l.startDate);
            const idx = Math.min(paidMonths, a.rows.length - 1);
            const row = a.rows[idx];
            const pct =
              paidMonths >= a.rows.length
                ? 100
                : idx >= 0
                  ? Math.min(100, Math.round((idx / a.rows.length) * 100))
                  : 0;
            return (
              <Card key={l.id}>
                <button onClick={() => setViewing(l)} className="press w-full text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ background: l.color }}
                      />
                      <h3 className="text-sm font-semibold truncate">{l.name}</h3>
                    </div>
                    <span className="text-xs text-muted tabular">{pct}%</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-dim">Cuota</p>
                      <p className="tabular font-medium mt-0.5">{formatMoney(a.monthlyPayment)}</p>
                    </div>
                    <div>
                      <p className="text-dim">Pendiente</p>
                      <p className="tabular font-medium mt-0.5">
                        {formatMoney(row?.balance ?? l.principal)}
                      </p>
                    </div>
                    <div>
                      <p className="text-dim">Total intereses</p>
                      <p className="tabular font-medium mt-0.5">{formatMoney(a.totalInterest)}</p>
                    </div>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-elevated overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: l.color }}
                    />
                  </div>
                </button>
              </Card>
            );
          })
        )}
      </div>

      <Sheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Nuevo préstamo"
        maxHeight="92vh"
      >
        <LoanForm onClose={() => setAddOpen(false)} />
      </Sheet>
      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title="Editar préstamo"
        maxHeight="92vh"
      >
        {editing && <LoanForm loan={editing} onClose={() => setEditing(null)} />}
      </Sheet>
      <Sheet
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing ? viewing.name : ''}
        maxHeight="92vh"
      >
        {viewing && (
          <LoanDetail
            loan={viewing}
            onEdit={() => {
              setEditing(viewing);
              setViewing(null);
            }}
          />
        )}
      </Sheet>
    </>
  );
}

function LoanForm({ loan, onClose }: { loan?: Loan; onClose: () => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState(loan?.name ?? '');
  const [principal, setPrincipal] = useState(loan ? String(loan.principal) : '');
  const [rate, setRate] = useState(loan ? String(loan.interestRate) : '');
  const [term, setTerm] = useState(loan ? String(loan.termMonths) : '');
  const [startDate, setStartDate] = useState(loan?.startDate ?? today);
  const [extra, setExtra] = useState(loan?.extraPayment ? String(loan.extraPayment) : '');
  const [notes, setNotes] = useState(loan?.notes ?? '');
  const [color, setColor] = useState(loan?.color ?? COLORS[0]);

  async function save() {
    const p = Number(principal);
    const r = Number(rate);
    const t = Number(term);
    if (
      !name ||
      !Number.isFinite(p) ||
      p <= 0 ||
      !Number.isFinite(r) ||
      r < 0 ||
      !Number.isFinite(t) ||
      t <= 0
    )
      return;
    const base: Omit<Loan, 'id' | 'createdAt'> = {
      name,
      principal: p,
      interestRate: r,
      termMonths: t,
      startDate,
      extraPayment: extra ? Number(extra) : undefined,
      color,
      notes: notes || undefined,
    };
    if (loan?.id) await db.loans.update(loan.id, base);
    else await db.loans.add({ ...base, createdAt: Date.now() });
    onClose();
  }

  async function remove() {
    if (!loan?.id) return;
    if (!window.confirm('¿Eliminar este préstamo? No se puede deshacer.')) return;
    await db.loans.delete(loan.id);
    onClose();
  }

  const preview = (() => {
    const p = Number(principal);
    const r = Number(rate);
    const t = Number(term);
    if (!Number.isFinite(p) || !Number.isFinite(r) || !Number.isFinite(t) || p <= 0 || t <= 0) {
      return null;
    }
    return amortize({
      name,
      principal: p,
      interestRate: r,
      termMonths: t,
      startDate,
      extraPayment: extra ? Number(extra) : undefined,
      color,
      createdAt: 0,
    });
  })();

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Coche, hipoteca..."
        autoFocus={!loan}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Capital (€)"
          type="number"
          inputMode="decimal"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          placeholder="20000"
        />
        <Input
          label="TAE / interés anual (%)"
          type="number"
          inputMode="decimal"
          value={rate}
          onChange={(e) => setRate(e.target.value)}
          placeholder="5.5"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Plazo (meses)"
          type="number"
          inputMode="numeric"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="60"
        />
        <Input
          label="Inicio"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </div>
      <Input
        label="Amortización anticipada extra/mes (opcional)"
        type="number"
        inputMode="decimal"
        value={extra}
        onChange={(e) => setExtra(e.target.value)}
        placeholder="0"
        hint="Pagas esto extra cada mes para terminar antes"
      />
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
      <Textarea label="Notas" value={notes} onChange={(e) => setNotes(e.target.value)} />

      {preview && (
        <Card>
          <p className="text-xs text-muted uppercase tracking-wider">Simulación</p>
          <div className="grid grid-cols-2 gap-3 mt-2 text-sm">
            <div>
              <p className="text-dim text-[11px]">Cuota mensual</p>
              <p className="tabular font-semibold">{formatMoney(preview.monthlyPayment)}</p>
            </div>
            <div>
              <p className="text-dim text-[11px]">Total pagado</p>
              <p className="tabular font-semibold">{formatMoney(preview.totalPaid)}</p>
            </div>
            <div>
              <p className="text-dim text-[11px]">Intereses</p>
              <p className="tabular font-semibold text-danger">
                {formatMoney(preview.totalInterest)}
              </p>
            </div>
            <div>
              <p className="text-dim text-[11px]">Acaba</p>
              <p className="tabular font-semibold">{formatDateLong(preview.endDate)}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
      {loan?.id && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar
        </Button>
      )}
    </div>
  );
}

function LoanDetail({ loan, onEdit }: { loan: Loan; onEdit: () => void }) {
  const a = useMemo(() => amortize(loan), [loan]);
  const paidMonths = monthsElapsed(loan.startDate);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[11px] text-muted uppercase tracking-wider">Cuota</p>
          <p className="tabular font-semibold mt-1">{formatMoney(a.monthlyPayment)}</p>
        </Card>
        <Card>
          <p className="text-[11px] text-muted uppercase tracking-wider">Plazo</p>
          <p className="tabular font-semibold mt-1">{a.months} meses</p>
        </Card>
        <Card>
          <p className="text-[11px] text-muted uppercase tracking-wider">Total intereses</p>
          <p className="tabular font-semibold mt-1 text-danger">{formatMoney(a.totalInterest)}</p>
        </Card>
        <Card>
          <p className="text-[11px] text-muted uppercase tracking-wider">Fin</p>
          <p className="tabular font-semibold mt-1">{formatDateLong(a.endDate)}</p>
        </Card>
      </div>
      <Button variant="secondary" full onClick={onEdit} leading={<Icon name="edit" size={16} />}>
        Editar
      </Button>
      <Card padded={false}>
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Tabla de amortización</h3>
          <p className="text-[11px] text-muted">
            Pagos: {paidMonths} / {a.months}
          </p>
        </div>
        <div className="max-h-[50vh] scroll-area">
          <table className="w-full text-xs tabular">
            <thead className="sticky top-0 bg-surface border-b border-border">
              <tr className="text-muted">
                <th className="text-left px-3 py-2 font-medium">#</th>
                <th className="text-left px-3 py-2 font-medium">Fecha</th>
                <th className="text-right px-3 py-2 font-medium">Capital</th>
                <th className="text-right px-3 py-2 font-medium">Interés</th>
                <th className="text-right px-3 py-2 font-medium">Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {a.rows.map((r, i) => (
                <tr
                  key={i}
                  className={`border-b border-border/50 ${i < paidMonths ? 'opacity-50' : ''}`}
                >
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2">{r.date.slice(0, 7)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(r.principal)}</td>
                  <td className="px-3 py-2 text-right text-danger">{formatMoney(r.interest)}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
