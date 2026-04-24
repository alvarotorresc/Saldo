/**
 * LedgerPage — Ledger reskin for Saldo v0.2 (F2).
 * Visual direction: Terminal / Technical.
 * Replaces TransactionsPage visually; legacy page kept untouched for F9 purge.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { db } from '@/db/database';
import { txByMonth } from '@/db/queries';
import { formatMoney } from '@/lib/format';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { FAB } from '@/ui/FAB';
import { Sheet } from '@/ui/Sheet';
import { Row } from '@/ui/primitives';
import { useApp } from '@/stores/app';
import type { Category, Transaction } from '@/types';
import { filterTx, groupTxByDate, summarize } from './LedgerPage.helpers';
import type { LedgerKindFilter } from './LedgerPage.helpers';
import { matchesFilter, useLedgerFilter } from '@/stores/ledgerFilter';
import { reapplyMonth } from '@/lib/rules';

// ─── Context menu ─────────────────────────────────────────────────────────────

interface ContextMenuState {
  tx: Transaction;
  x: number;
  y: number;
}

// ─── Inline month switcher (terminal-style, no rounded pill) ─────────────────

interface MonthSwitcherInlineProps {
  month: string;
  onChange: (m: string) => void;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, (m ?? 1) - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function MonthSwitcherInline({ month, onChange }: MonthSwitcherInlineProps) {
  const now = currentMonth();
  const nextDisabled = month >= now;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onChange(shiftMonth(month, -1))}
        className="p-1 text-muted"
        aria-label="Mes anterior"
      >
        <Icon name="chev-l" size={14} />
      </button>
      <span className="font-mono text-mono10 text-dim tracking-wider">{month}</span>
      <button
        type="button"
        onClick={() => {
          if (!nextDisabled) onChange(shiftMonth(month, 1));
        }}
        aria-disabled={nextDisabled}
        aria-label="Mes siguiente"
        className={`p-1 ${nextDisabled ? 'text-dim opacity-40 cursor-not-allowed' : 'text-muted'}`}
      >
        <Icon name="chev-r" size={14} />
      </button>
    </div>
  );
}

// ─── Category picker sheet (for "Cambiar categoría") ─────────────────────────

interface CategoryPickerProps {
  onPick: (categoryId: number) => void;
  onClose: () => void;
}

function CategoryPicker({ onPick, onClose }: CategoryPickerProps) {
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  return (
    <div>
      <div className="divide-y divide-border">
        {(categories ?? []).map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="press w-full text-left px-3 py-2.5 flex items-center justify-between"
            onClick={() => {
              if (cat.id != null) {
                onPick(cat.id);
                onClose();
              }
            }}
          >
            <span className="font-mono text-mono11 text-text">{cat.name}</span>
            {cat.color && (
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ background: cat.color }}
                aria-hidden="true"
              />
            )}
          </button>
        ))}
        {(categories?.length ?? 0) === 0 && (
          <p className="p-3 font-mono text-mono10 text-dim">Sin categorías disponibles.</p>
        )}
      </div>
      <div className="p-3 pt-0">
        <button
          type="button"
          onClick={onClose}
          className="press w-full mt-3 py-2.5 border border-border font-mono text-mono10 text-dim tracking-wider"
        >
          CANCELAR
        </button>
      </div>
    </div>
  );
}

// ─── Transaction row with long-press support ──────────────────────────────────

interface TxRowProps {
  tx: Transaction;
  catName: string | undefined;
  onLongPress: (tx: Transaction) => void;
  onClick: (tx: Transaction) => void;
}

const LONG_PRESS_MS = 500;

function TxRowItem({ tx, catName, onLongPress, onClick }: TxRowProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPressRef = useRef(false);

  function clearTimer() {
    if (timerRef.current != null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handlePointerDown() {
    didLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      didLongPressRef.current = true;
      onLongPress(tx);
    }, LONG_PRESS_MS);
  }

  function handlePointerUp() {
    clearTimer();
  }

  function handlePointerCancel() {
    clearTimer();
  }

  function handlePointerLeave() {
    clearTimer();
  }

  function handleClick() {
    // If a long-press fired, suppress the click so it doesn't also open TxForm.
    if (didLongPressRef.current) {
      didLongPressRef.current = false;
      return;
    }
    onClick(tx);
  }

  // Format time from date — transactions only store date, no time field in schema.
  const label = tx.merchant ?? tx.description;
  const sub = `${catName ?? 'Sin categoría'}`;
  const source = tx.source && tx.source !== 'manual' ? tx.source.toUpperCase() : null;

  let amountColor = 'text-muted';
  let amountSign = '';
  if (tx.kind === 'income') {
    amountColor = 'text-accent';
    amountSign = '+';
  } else if (tx.kind === 'expense') {
    amountColor = 'text-danger';
    amountSign = '−';
  }

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onPointerLeave={handlePointerLeave}
      onClick={handleClick}
    >
      <Row
        left={label}
        sub={sub}
        right={
          <span className={`font-mono text-mono12 tabular ${amountColor}`}>
            {amountSign}
            {formatMoney(tx.amount)}
          </span>
        }
        meta={source ? <span className="text-dim">{source}</span> : undefined}
      />
    </div>
  );
}

// ─── Tab labels ───────────────────────────────────────────────────────────────

const TABS: { label: string; value: LedgerKindFilter }[] = [
  { label: 'ALL', value: 'all' },
  { label: 'IN', value: 'income' },
  { label: 'OUT', value: 'expense' },
  { label: 'TRANSFERS', value: 'transfer' },
];

// ─── LedgerPage ───────────────────────────────────────────────────────────────

interface LedgerPageProps {
  onOpenTx?: (txId: number) => void;
  onOpenFilter?: () => void;
  onNewTx?: () => void;
}

export function LedgerPage({ onOpenTx, onOpenFilter, onNewTx }: LedgerPageProps = {}) {
  const month = useApp((s) => s.month);
  const setMonth = useApp((s) => s.setMonth);

  const [query, setQuery] = useState('');
  const [inputFocused, setInputFocused] = useState(false);
  const [kindFilter, setKindFilter] = useState<LedgerKindFilter>('all');

  // Context menu state
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [catPickerTx, setCatPickerTx] = useState<Transaction | null>(null);

  // Data
  const all = useLiveQuery(() => txByMonth(month), [month]);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const catById = useMemo(() => {
    const map = new Map<number, Category>();
    (categories ?? []).forEach((c) => c.id != null && map.set(c.id as number, c));
    return map;
  }, [categories]);

  const filterState = useLedgerFilter();
  const filtered = useMemo(() => {
    const base = filterTx(all ?? [], query, kindFilter);
    // Apply FilterSheet state on top. Period=current is a no-op here because
    // `all` is already scoped to the active month via useLiveQuery below.
    return base.filter((t) => matchesFilter(t, filterState, month));
  }, [all, query, kindFilter, filterState, month]);

  // Pull-to-refresh state: track pointer drag while scrollTop === 0 and, when
  // the user drags down ≥60px, invoke reapplyMonth(month).
  const scrollRef = useRef<HTMLDivElement>(null);
  const ptrStartY = useRef<number | null>(null);
  const [ptrPull, setPtrPull] = useState(0);
  const [ptrStatus, setPtrStatus] = useState<'idle' | 'refreshing' | 'done'>('idle');
  const [ptrUpdated, setPtrUpdated] = useState(0);

  function onPtrDown(e: React.PointerEvent<HTMLDivElement>) {
    const el = scrollRef.current;
    if (!el || el.scrollTop > 0) return;
    ptrStartY.current = e.clientY;
  }
  function onPtrMove(e: React.PointerEvent<HTMLDivElement>) {
    if (ptrStartY.current == null) return;
    const delta = e.clientY - ptrStartY.current;
    if (delta <= 0) {
      setPtrPull(0);
      return;
    }
    setPtrPull(Math.min(120, delta));
  }
  async function onPtrUp() {
    const pull = ptrPull;
    ptrStartY.current = null;
    setPtrPull(0);
    if (pull < 60 || ptrStatus === 'refreshing') return;
    setPtrStatus('refreshing');
    try {
      const n = await reapplyMonth(month);
      setPtrUpdated(n);
      setPtrStatus('done');
      setTimeout(() => setPtrStatus('idle'), 1500);
    } catch {
      setPtrStatus('idle');
    }
  }

  const groups = useMemo(() => groupTxByDate(filtered), [filtered]);
  const summary = useMemo(() => summarize(filtered), [filtered]);

  // ── Long-press context menu actions ────────────────────────────────────────

  function handleLongPress(tx: Transaction) {
    setContextMenu({ tx, x: 0, y: 0 });
  }

  async function handleDuplicate(tx: Transaction) {
    const { id: _id, ...rest } = tx;
    await db.transactions.add({ ...rest, createdAt: Date.now() });
    setContextMenu(null);
  }

  async function handleDelete(tx: Transaction) {
    if (!window.confirm(`¿Eliminar "${tx.merchant ?? tx.description}"? No se puede deshacer.`)) {
      setContextMenu(null);
      return;
    }
    if (tx.id != null) await db.transactions.delete(tx.id);
    setContextMenu(null);
  }

  function handleChangeCat(tx: Transaction) {
    setCatPickerTx(tx);
    setContextMenu(null);
  }

  async function handlePickCategory(categoryId: number) {
    if (catPickerTx?.id != null) {
      await db.transactions.update(catPickerTx.id, { categoryId });
    }
    setCatPickerTx(null);
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isEmpty = (all ?? []).length === 0;
  const showCaret = !inputFocused && !query;

  return (
    <>
      {/* Top bar */}
      <TopBarV2
        title="saldo@local"
        sub="LEDGER"
        right={<MonthSwitcherInline month={month} onChange={setMonth} />}
      />

      {/* Search bar */}
      <div className="border-b border-border px-3 py-2 bg-surface flex items-center gap-2">
        <Icon name="search" size={13} className="text-muted shrink-0" />
        <div className="flex-1 flex items-center font-mono text-mono11 min-w-0">
          <span className="text-muted shrink-0">$ grep -e&nbsp;</span>
          <div className="relative flex-1 flex items-center">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder=".*"
              aria-label="Buscar movimientos"
              className="flex-1 min-w-0 bg-transparent outline-none text-text placeholder:text-dim font-mono text-mono11"
            />
            {showCaret && <span className="caret-blink pointer-events-none" aria-hidden="true" />}
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenFilter}
          aria-label="Filtros"
          className="press p-1 text-muted shrink-0"
          data-testid="ledger-filter-btn"
        >
          <Icon name="filter" size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border" role="tablist">
        {TABS.map((tab) => {
          const active = kindFilter === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKindFilter(tab.value)}
              className={[
                'flex-1 py-2.5 text-center font-mono text-mono10 tracking-widest',
                active
                  ? 'text-text border-b border-accent'
                  : 'text-dim border-b border-transparent',
              ].join(' ')}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Summary bar */}
      {!isEmpty && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface font-mono text-mono10 text-muted tracking-wider">
          <span>
            COUNT=<span className="text-text">{summary.count}</span>
          </span>
          <span>
            IN=<span className="text-accent">+{formatMoney(summary.income)}</span>
          </span>
          <span>
            OUT=<span className="text-danger">−{formatMoney(summary.expense)}</span>
          </span>
          <span>
            Δ=
            <span className={summary.delta >= 0 ? 'text-accent' : 'text-danger'}>
              {summary.delta >= 0 ? '+' : '−'}
              {formatMoney(Math.abs(summary.delta))}
            </span>
          </span>
        </div>
      )}

      {/* Pull-to-refresh indicator */}
      {(ptrPull > 0 || ptrStatus !== 'idle') && (
        <div
          className="flex items-center justify-center py-2 font-mono text-mono9 text-dim tracking-widest uppercase border-b border-border"
          data-testid="ptr-indicator"
          style={{ height: Math.max(0, Math.min(ptrPull, 60)) + 20 }}
        >
          {ptrStatus === 'refreshing'
            ? 'REAPPLY_RULES…'
            : ptrStatus === 'done'
              ? `${ptrUpdated} TX ACTUALIZADAS`
              : ptrPull >= 60
                ? 'RELEASE → REAPPLY'
                : 'PULL ↓ REAPPLY'}
        </div>
      )}

      {/* Transaction list */}
      <div
        ref={scrollRef}
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        onPointerCancel={onPtrUp}
        className="scroll-area flex-1"
      >
        {isEmpty ? (
          /* Empty state — terminal ASCII style */
          <div className="flex flex-col items-center justify-center h-full py-16 px-4">
            <pre className="font-mono text-mono10 text-dim leading-tight text-center select-none">
              {`┌───────────────────────┐\n│   LEDGER LIMPIO       │\n└───────────────────────┘`}
            </pre>
            <p className="font-mono text-mono10 text-muted mt-4 tracking-wider">Ledger limpio</p>
            <p className="font-mono text-mono9 text-dim mt-2 tracking-wider">
              $ wc -l ledger.db → 0
            </p>
          </div>
        ) : groups.length === 0 ? (
          /* No results for active filter/query */
          <div className="flex flex-col items-center justify-center py-16 px-4">
            <p className="font-mono text-mono10 text-dim tracking-wider">SIN RESULTADOS</p>
            <p className="font-mono text-mono9 text-muted mt-1">$ grep: no matches found</p>
          </div>
        ) : (
          <>
            {groups.map(({ date, total, txs }) => (
              <div key={date}>
                {/* Date header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 bg-bg border-t border-border">
                  <span className="font-mono text-mono10 text-muted tracking-wider">{date}</span>
                  <span className="font-mono text-mono10 text-dim">
                    Σ{' '}
                    <span className={total >= 0 ? 'text-accent' : 'text-danger'}>
                      {total >= 0 ? '+' : '−'}
                      {formatMoney(Math.abs(total))}
                    </span>
                  </span>
                </div>

                {/* Rows */}
                {txs.map((tx) => {
                  const cat = tx.categoryId != null ? catById.get(tx.categoryId) : undefined;
                  return (
                    <TxRowItem
                      key={tx.id}
                      tx={tx}
                      catName={cat?.name}
                      onLongPress={handleLongPress}
                      onClick={(t) => {
                        if (onOpenTx && t.id != null) onOpenTx(t.id);
                      }}
                    />
                  );
                })}
              </div>
            ))}

            {/* End-of-list marker */}
            <div className="py-4 text-center font-mono text-mono9 text-dim tracking-wider">
              — END · {filtered.length} TX —
            </div>
          </>
        )}
      </div>

      {/* FAB — only when there are transactions */}
      {!isEmpty && (
        <FAB
          aria-label="Añadir movimiento"
          icon={<Icon name="plus" size={20} />}
          onClick={() => onNewTx?.()}
        />
      )}

      {/* Context menu sheet */}
      <Sheet
        open={contextMenu != null}
        onClose={() => setContextMenu(null)}
        ariaLabel="Opciones del movimiento"
      >
        {contextMenu && (
          <div className="divide-y divide-border">
            <button
              type="button"
              className="press w-full text-left px-3 py-3.5 flex items-center gap-3 font-mono text-mono11 text-text"
              onClick={() => handleDuplicate(contextMenu.tx)}
            >
              <Icon name="copy" size={15} className="text-muted" />
              Duplicar
            </button>
            <button
              type="button"
              className="press w-full text-left px-3 py-3.5 flex items-center gap-3 font-mono text-mono11 text-danger"
              onClick={() => handleDelete(contextMenu.tx)}
            >
              <Icon name="trash" size={15} className="text-danger" />
              Borrar
            </button>
            <button
              type="button"
              className="press w-full text-left px-3 py-3.5 flex items-center gap-3 font-mono text-mono11 text-text"
              onClick={() => handleChangeCat(contextMenu.tx)}
            >
              <Icon name="tag" size={15} className="text-muted" />
              Cambiar categoría
            </button>
          </div>
        )}
      </Sheet>

      {/* Category picker sheet */}
      <Sheet
        open={catPickerTx != null}
        onClose={() => setCatPickerTx(null)}
        title="Cambiar categoría"
      >
        {catPickerTx && (
          <CategoryPicker onPick={handlePickCategory} onClose={() => setCatPickerTx(null)} />
        )}
      </Sheet>

      {/* TODO: Pull-to-refresh — no bulk reapplyRules() exported from categorize.ts.
          Implement when a bulk recategorize function is added to @/lib/categorize. */}
    </>
  );
}
