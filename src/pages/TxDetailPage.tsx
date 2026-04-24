/**
 * TxDetailPage — F5 tx detail view. Hero amount + KV grid + notes + related tx.
 * Delete lives here; no tombstone table yet so the delete is a straight Dexie
 * removal (tombstone support is deferred until export/restore lands in F8).
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useMemo, useState } from 'react';
import { db } from '@/db/database';
import { effectiveAmount } from '@/db/queries';
import { formatMoney } from '@/lib/format';
import { txHash } from '@/lib/txHash';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Btn, KV, Section } from '@/ui/primitives';
import type { Transaction } from '@/types';

interface Props {
  txId: number;
  onBack: () => void;
  onDeleted?: () => void;
}

export function TxDetailPage({ txId, onBack, onDeleted }: Props) {
  const tx = useLiveQuery(() => db.transactions.get(txId), [txId]);
  const category = useLiveQuery(
    async () => (tx?.categoryId ? db.categories.get(tx.categoryId) : undefined),
    [tx?.categoryId],
  );
  const account = useLiveQuery(
    async () => (tx ? db.accounts.get(tx.accountId) : undefined),
    [tx?.accountId],
  );
  const matchedRule = useLiveQuery(
    async () =>
      tx?.categoryId
        ? db.rules
            .where('categoryId')
            .equals(tx.categoryId)
            .filter((r) =>
              tx.merchant
                ? tx.merchant.toLowerCase().includes(r.pattern.toLowerCase())
                : tx.description.toLowerCase().includes(r.pattern.toLowerCase()),
            )
            .first()
        : undefined,
    [tx?.categoryId, tx?.merchant, tx?.description],
  );
  const related = useLiveQuery(async () => {
    if (!tx?.merchant) return [] as Transaction[];
    const rows = await db.transactions
      .where('accountId')
      .equals(tx.accountId)
      .filter(
        (t) =>
          t.id !== tx.id &&
          t.merchant != null &&
          tx.merchant != null &&
          t.merchant.toLowerCase() === tx.merchant.toLowerCase(),
      )
      .sortBy('date');
    return rows.reverse().slice(0, 6);
  }, [tx?.merchant, tx?.id]);

  const [notes, setNotes] = useState('');
  useEffect(() => {
    setNotes(tx?.notes ?? '');
  }, [tx?.id, tx?.notes]);

  const [hash, setHash] = useState('');
  useEffect(() => {
    if (!tx) return;
    let cancel = false;
    txHash(tx).then((h) => {
      if (!cancel) setHash(h);
    });
    return () => {
      cancel = true;
    };
  }, [tx]);

  const sharedAmount = useMemo(() => (tx ? effectiveAmount(tx) : 0), [tx]);

  if (!tx) {
    return (
      <>
        <TopBarV2 title="tx" onBack={onBack} />
        <div className="flex-1 p-4 font-mono text-mono10 text-dim">Cargando...</div>
      </>
    );
  }

  const isIncome = tx.kind === 'income';
  const color = isIncome ? 'var(--color-accent)' : 'var(--color-danger)';

  async function saveNotes() {
    if (!tx?.id) return;
    await db.transactions.update(tx.id, { notes: notes.trim() || undefined });
  }

  async function duplicate() {
    if (!tx) return;
    const { id, ...rest } = tx;
    void id;
    await db.transactions.add({ ...rest, createdAt: Date.now() });
    onBack();
  }

  async function remove() {
    if (!tx?.id) return;
    if (typeof window !== 'undefined' && !window.confirm('¿Borrar este movimiento?')) return;
    const fingerprint = await txHash(tx);
    await db.transaction('rw', db.transactions, db.txTombstones, async () => {
      await db.txTombstones
        .put({ txHash: fingerprint, deletedAt: Date.now() })
        .catch(() => undefined);
      if (tx.id != null) await db.transactions.delete(tx.id);
    });
    if (onDeleted) onDeleted();
    else onBack();
  }

  return (
    <>
      <TopBarV2
        title={`tx #${tx.id}`}
        sub={tx.date}
        onBack={onBack}
        right={
          <button
            type="button"
            onClick={duplicate}
            className="font-mono text-mono9 text-muted tracking-widest uppercase press"
            aria-label="Duplicar"
          >
            <Icon name="copy" size={12} />
          </button>
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="tx-detail">
        {/* HERO */}
        <section className="px-3.5 py-4 border-b border-border">
          <div className="font-mono text-mono9 text-dim tracking-widest uppercase">
            {isIncome ? 'INCOME' : 'EXPENSE'}
          </div>
          <div
            className="font-mono text-[42px] leading-none tabular mt-1"
            style={{ color }}
            data-testid="tx-detail-amount"
          >
            {isIncome ? '+' : '−'}
            {formatMoney(sharedAmount)}
          </div>
          <div className="font-mono text-mono10 text-muted mt-1 truncate">
            {tx.merchant ?? tx.description}
          </div>
        </section>

        <Section title="DETAILS">
          <div className="border border-border rounded-xs">
            <KV label="ACCOUNT" value={account?.name ?? '—'} />
            <KV label="SOURCE" value={tx.source ?? 'manual'} />
            <KV label="CATEGORY" value={category?.name ?? 'sin categoría'} />
            <KV
              label="TAGS"
              value={(tx.tags ?? []).length > 0 ? (tx.tags ?? []).join(', ') : '—'}
            />
            <KV label="TX_ID" value={String(tx.id ?? '—')} />
            <KV
              label="CREATED"
              value={new Date(tx.createdAt).toISOString().slice(0, 19).replace('T', ' ')}
            />
            <KV
              label="HASH"
              value={
                <span className="font-mono text-mono9 text-dim truncate block max-w-[180px]">
                  {hash.slice(0, 16)}…
                </span>
              }
            />
          </div>
        </Section>

        <Section title="NOTES">
          <textarea
            className="w-full bg-transparent border border-border rounded-xs p-2 font-mono text-mono11 text-text resize-none focus:outline-none focus:border-borderStrong"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => void saveNotes()}
            placeholder="Añade una nota..."
            data-testid="tx-notes"
          />
        </Section>

        {matchedRule && (
          <Section title="RULE_MATCHED">
            <div className="border border-border rounded-xs p-2 font-mono text-[11px] text-text">
              <span className="text-dim">WHEN</span> merchant ~{' '}
              <span className="text-accent">/{matchedRule.pattern}/i</span>{' '}
              <span className="text-dim">THEN</span> category ={' '}
              <span className="text-accent">"{category?.name ?? '—'}"</span>
            </div>
          </Section>
        )}

        {related && related.length > 0 && (
          <Section title="RELATED_TX">
            <ul className="font-mono text-[11px]">
              {related.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-[48px_1fr_auto] gap-2 py-1.5 border-b border-border last:border-b-0"
                >
                  <span className="text-dim">{r.date.slice(5)}</span>
                  <span className="text-text truncate">{r.description}</span>
                  <span className="text-text tabular">
                    {r.kind === 'income' ? '+' : '−'}
                    {formatMoney(effectiveAmount(r))}
                  </span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Actions */}
        <section className="px-3.5 pt-4 pb-3 flex gap-2">
          <Btn variant="ghost" onClick={duplicate} data-testid="tx-duplicate">
            DUPLICAR
          </Btn>
          <Btn variant="danger" onClick={remove} data-testid="tx-delete">
            BORRAR
          </Btn>
        </section>
      </div>
    </>
  );
}
