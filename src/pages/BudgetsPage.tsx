/**
 * BudgetsPage — F6 terminal-style budgets. List of per-category budgets with
 * bar, pct, over badge, end-of-month projection, inline limit edit stepper.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { expensesByCategory, sumByKind } from '@/db/queries';
import { formatMoney } from '@/lib/format';
import { budgetStats } from '@/lib/budgets';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn, Section } from '@/ui/primitives';
import { Sheet } from '@/ui/Sheet';
import { useApp } from '@/stores/app';
import type { Budget, Category } from '@/types';

interface Props {
  onBack: () => void;
}

export function BudgetsPage({ onBack }: Props) {
  const month = useApp((s) => s.month);
  const budgets = useLiveQuery(
    () => db.budgets.where('month').anyOf([month, '*']).toArray(),
    [month],
  );
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const spentByCat = useLiveQuery(() => expensesByCategory(month), [month]);
  const totals = useLiveQuery(() => sumByKind(month), [month]);

  const [addOpen, setAddOpen] = useState(false);

  const rows = useMemo(() => {
    return (budgets ?? []).map((b) => {
      const cat = (categories ?? []).find((c) => c.id === b.categoryId);
      const spent =
        (spentByCat && typeof b.categoryId === 'number' ? spentByCat.get(b.categoryId) : 0) ?? 0;
      return { b, cat, spent, stats: budgetStats(spent, b.amount, month) };
    });
  }, [budgets, categories, spentByCat, month]);

  const totalLimit = rows.reduce((s, r) => s + r.b.amount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.stats.spent, 0);
  const monthStats = totalLimit > 0 ? budgetStats(totalSpent, totalLimit, month) : null;

  const expense = totals?.expense ?? 0;

  return (
    <>
      <TopBarV2 title="budgets" sub={month} onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="budgets-page">
        {/* HERO totals */}
        <section className="px-3.5 py-4 border-b border-border">
          <div className="flex justify-between font-mono text-mono9 text-dim tracking-widest uppercase">
            <span>TOTAL_SPEND · {month}</span>
            {monthStats && (
              <span className={monthStats.over ? 'text-danger' : 'text-accent'}>
                {Math.round(monthStats.pct * 100)}%
              </span>
            )}
          </div>
          <div className="font-mono text-[28px] tabular text-text mt-1">
            {formatMoney(totalSpent)}
            {totalLimit > 0 && (
              <span className="text-muted text-[14px]"> / {formatMoney(totalLimit)}</span>
            )}
          </div>
          {monthStats && (
            <div className="mt-1 font-mono text-mono9 text-dim">
              projected → {formatMoney(monthStats.projected)} @ day {monthStats.dayOfMonth}/
              {monthStats.daysInMonth}
            </div>
          )}
          <div className="mt-2 h-[3px] bg-surface overflow-hidden">
            <div
              className="h-full"
              style={{
                width: `${Math.min(100, Math.round((totalSpent / Math.max(totalLimit, 1)) * 100))}%`,
                background: monthStats?.over ? 'var(--color-danger)' : 'var(--color-accent)',
              }}
            />
          </div>
        </section>

        {/* Rows */}
        <Section title="BUDGETS">
          {rows.length === 0 && (
            <div className="font-mono text-mono10 text-dim py-2">
              No hay presupuestos. Crea el primero.
            </div>
          )}
          <ul className="space-y-2.5">
            {rows.map(({ b, cat, stats }) => (
              <BudgetRow
                key={b.id}
                budget={b}
                category={cat}
                spent={stats.spent}
                pct={stats.pct}
                over={stats.over}
                onDelete={async () => {
                  if (b.id != null && window.confirm(`¿Borrar budget de ${cat?.name}?`)) {
                    await db.budgets.delete(b.id);
                  }
                }}
                onChange={async (amount) => {
                  if (b.id != null) await db.budgets.update(b.id, { amount });
                }}
              />
            ))}
          </ul>
        </Section>

        <div className="px-3.5 py-3">
          <Btn variant="solid" block onClick={() => setAddOpen(true)} data-testid="add-budget">
            + NEW_BUDGET
          </Btn>
          <div className="mt-2 font-mono text-mono9 text-dim text-center">
            gasto real del mes: {formatMoney(expense)}
          </div>
        </div>
      </div>

      <AddBudgetSheet
        open={addOpen}
        onClose={() => setAddOpen(false)}
        month={month}
        existing={new Set(rows.map((r) => r.b.categoryId))}
      />
    </>
  );
}

function BudgetRow({
  budget,
  category,
  spent,
  pct,
  over,
  onChange,
  onDelete,
}: {
  budget: Budget;
  category: Category | undefined;
  spent: number;
  pct: number;
  over: boolean;
  onChange: (amount: number) => void | Promise<void>;
  onDelete: () => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(budget.amount));
  const color = category?.color ?? 'var(--color-accent)';
  return (
    <li className="border border-border rounded-xs p-2.5">
      <div className="flex items-center justify-between mb-1">
        <span className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
          <span className="font-mono text-mono11 text-text truncate">
            {category?.name ?? 'categoría borrada'}
          </span>
          {over && (
            <span className="font-mono text-mono9 text-danger border border-danger px-1 rounded-xs">
              OVER
            </span>
          )}
        </span>
        <span className="font-mono text-mono10 text-dim shrink-0">
          {formatMoney(spent)} / {formatMoney(budget.amount)}
        </span>
      </div>
      <div className="h-[3px] bg-surface overflow-hidden">
        <div
          className="h-full"
          style={{
            width: `${Math.min(100, Math.round(pct * 100))}%`,
            background: over ? 'var(--color-danger)' : color,
            opacity: 0.9,
          }}
        />
      </div>
      <div className="mt-1.5 flex gap-2 items-center justify-end">
        {editing ? (
          <>
            <input
              type="number"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              data-testid={`budget-input-${budget.id}`}
              className="w-20 bg-transparent border border-border rounded-xs px-1.5 py-0.5 font-mono text-mono10 text-text focus:outline-none focus:border-borderStrong"
            />
            <button
              type="button"
              onClick={() => {
                const n = Number(value);
                if (Number.isFinite(n) && n >= 0) onChange(n);
                setEditing(false);
              }}
              className="font-mono text-mono9 text-accent press"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(String(budget.amount));
                setEditing(false);
              }}
              className="font-mono text-mono9 text-dim press"
            >
              CANCEL
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono text-mono9 text-muted press"
              data-testid={`budget-edit-${budget.id}`}
            >
              EDIT
            </button>
            <button
              type="button"
              onClick={() => void onDelete()}
              className="font-mono text-mono9 text-danger press"
            >
              DELETE
            </button>
          </>
        )}
      </div>
    </li>
  );
}

function AddBudgetSheet({
  open,
  onClose,
  month,
  existing,
}: {
  open: boolean;
  onClose: () => void;
  month: string;
  existing: Set<number>;
}) {
  const categories = useLiveQuery(
    () => db.categories.where('kind').equals('expense').toArray(),
    [],
  );
  const [amount, setAmount] = useState('');
  const [catId, setCatId] = useState<number | undefined>(undefined);
  async function commit() {
    const n = Number(amount);
    if (!catId || !Number.isFinite(n) || n <= 0) return;
    await db.budgets.add({ month, categoryId: catId, amount: n, createdAt: Date.now() });
    setAmount('');
    setCatId(undefined);
    onClose();
  }
  return (
    <Sheet open={open} onClose={onClose} title="Nuevo budget">
      <div className="space-y-3 font-mono">
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">CATEGORY</span>
          <select
            value={catId ?? ''}
            onChange={(e) => setCatId(Number(e.target.value) || undefined)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono11 text-text"
            data-testid="budget-category-select"
          >
            <option value="">—</option>
            {(categories ?? [])
              .filter((c) => c.id != null && !existing.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <label className="block">
          <span className="text-mono9 text-dim uppercase tracking-widest">LIMIT · EUR</span>
          <input
            type="number"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full bg-transparent border border-border rounded-xs px-2 py-2 text-mono12 text-text focus:outline-none focus:border-borderStrong"
            data-testid="budget-amount-input"
          />
        </label>
        <Btn variant="solid" block onClick={commit} disabled={!catId || !amount}>
          COMMIT
        </Btn>
      </div>
    </Sheet>
  );
}
