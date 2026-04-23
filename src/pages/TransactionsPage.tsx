import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { effectiveAmount, txByMonth } from '@/db/queries';
import { formatDate, formatMoney } from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Money } from '@/ui/Money';
import { MonthSwitcher } from '@/ui/MonthSwitcher';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { EmptyState } from '@/ui/EmptyState';
import { useApp } from '@/stores/app';
import type { Category, Transaction } from '@/types';
import { TxForm } from '@/features/transactions/TxForm';

export function TransactionsPage() {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const all = useLiveQuery(() => txByMonth(month), [month]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const catById = useMemo(() => {
    const map = new Map<number, Category>();
    (categories ?? []).forEach((c) => c.id && map.set(c.id, c));
    return map;
  }, [categories]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const q = query.trim().toLowerCase();
    return all.filter((t) => {
      if (kindFilter !== 'all' && t.kind !== kindFilter) return false;
      if (!q) return true;
      return (
        t.description.toLowerCase().includes(q) ||
        (t.merchant ?? '').toLowerCase().includes(q) ||
        (t.tags ?? []).some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [all, query, kindFilter]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const t of filtered) {
      const arr = map.get(t.date) ?? [];
      arr.push(t);
      map.set(t.date, arr);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <>
      <TopBar
        title="Movimientos"
        trailing={
          <button
            onClick={() => setAddOpen(true)}
            className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
            aria-label="Añadir movimiento"
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="px-4 space-y-3">
        <MonthSwitcher month={month} onChange={setMonth} />
        <div className="relative">
          <Icon
            name="search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-dim"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-elevated border border-border outline-none placeholder:text-dim text-sm"
          />
        </div>
        <SegmentedControl
          value={kindFilter}
          onChange={setKindFilter}
          options={[
            { value: 'all', label: 'Todo' },
            { value: 'expense', label: 'Gastos' },
            { value: 'income', label: 'Ingresos' },
          ]}
        />
      </div>

      <div className="scroll-area flex-1 px-4 pt-3 pb-6">
        {filtered.length === 0 ? (
          <EmptyState
            title="Sin movimientos"
            description="Importa un extracto o añade uno manualmente."
          />
        ) : (
          <div className="space-y-4">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <p className="text-[11px] uppercase tracking-wider text-dim px-1 mb-2">
                  {formatDate(date)}
                </p>
                <Card padded={false}>
                  <ul className="divide-y divide-border">
                    {items.map((t) => {
                      const cat = t.categoryId ? catById.get(t.categoryId) : undefined;
                      const shared = t.personalAmount != null;
                      const effective = effectiveAmount(t);
                      const isReimb = !!t.reimbursementFor;
                      return (
                        <li key={t.id}>
                          <button
                            onClick={() => setEditing(t)}
                            className="w-full press px-4 py-3 flex items-center gap-3 text-left"
                          >
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
                                {shared && (
                                  <span className="text-info" title="Compartido">
                                    <Icon name="users" size={13} />
                                  </span>
                                )}
                                {isReimb && (
                                  <span className="text-info" title="Devolución">
                                    <Icon name="link" size={13} />
                                  </span>
                                )}
                              </p>
                              <p className="text-[11px] text-muted truncate">
                                {cat?.name ?? 'Sin categoría'}
                                {shared && (
                                  <>
                                    {' · '}
                                    <span className="text-info">
                                      tu parte {formatMoney(effective)} de {formatMoney(t.amount)}
                                    </span>
                                  </>
                                )}
                                {isReimb && ' · devolución'}
                                {t.source && t.source !== 'manual' && (
                                  <span className="ml-1 text-dim">· {t.source.toUpperCase()}</span>
                                )}
                              </p>
                            </div>
                            <div className="flex flex-col items-end">
                              <Money
                                value={t.amount}
                                kind={t.kind === 'expense' ? 'expense' : 'income'}
                                signed
                                className="text-sm font-medium"
                              />
                              {shared && (
                                <span className="text-[11px] text-info tabular">
                                  (−{formatMoney(effective)})
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              </div>
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Movimiento">
        {editing && <TxForm tx={editing} onClose={() => setEditing(null)} />}
      </Sheet>

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Nuevo movimiento">
        <TxForm onClose={() => setAddOpen(false)} />
      </Sheet>
    </>
  );
}
