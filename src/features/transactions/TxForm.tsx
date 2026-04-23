import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/database';
import { categorize } from '@/lib/categorize';
import { monthKey } from '@/lib/importers/parse-helpers';
import type { Category, Transaction } from '@/types';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Input, Select, Textarea } from '@/ui/Input';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { formatDate, formatMoney } from '@/lib/format';

interface Props {
  tx?: Transaction;
  defaultAccountId?: number;
  onClose: () => void;
}

export function TxForm({ tx, defaultAccountId, onClose }: Props) {
  const isEdit = !!tx?.id;
  const today = new Date().toISOString().slice(0, 10);

  const [desc, setDesc] = useState(tx?.merchant ?? tx?.description ?? '');
  const [amount, setAmount] = useState(tx ? String(tx.amount) : '');
  const [kind, setKind] = useState<Transaction['kind']>(tx?.kind ?? 'expense');
  const [categoryId, setCategoryId] = useState<number>(tx?.categoryId ?? 0);
  const [date, setDate] = useState(tx?.date ?? today);
  const [notes, setNotes] = useState(tx?.notes ?? '');
  const [tagsText, setTagsText] = useState((tx?.tags ?? []).join(', '));
  const [isSplit, setIsSplit] = useState(tx?.personalAmount != null);
  const [personalAmount, setPersonalAmount] = useState(
    tx?.personalAmount != null ? String(tx.personalAmount) : '',
  );
  const [splitPeople, setSplitPeople] = useState(tx?.splitPeople ? String(tx.splitPeople) : '');
  const [splitNote, setSplitNote] = useState(tx?.splitNote ?? '');
  const [reimbursementFor, setReimbursementFor] = useState<number | undefined>(
    tx?.reimbursementFor,
  );
  const [linkPicker, setLinkPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const pendingExpenses = useLiveQuery(
    () =>
      db.transactions
        .where('kind')
        .equals('expense')
        .filter((t) => t.personalAmount != null && t.personalAmount < t.amount)
        .reverse()
        .sortBy('date'),
    [],
  );

  useEffect(() => {
    if (isSplit && splitPeople && amount && !personalAmount) {
      const n = Number(splitPeople);
      const a = Number(amount);
      if (n > 0 && a > 0) setPersonalAmount((a / n).toFixed(2));
    }
  }, [splitPeople, amount, isSplit, personalAmount]);

  const expenseCats = (categories ?? []).filter((c: Category) => c.kind === 'expense');
  const incomeCats = (categories ?? []).filter((c: Category) => c.kind === 'income');

  async function save() {
    setError(null);
    const a = Number(amount);
    if (!desc.trim()) {
      setError('Añade una descripción.');
      return;
    }
    if (!Number.isFinite(a) || a <= 0) {
      setError('El importe debe ser un número mayor que 0.');
      return;
    }
    const pa = isSplit && personalAmount ? Number(personalAmount) : undefined;
    const tags = tagsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const base: Omit<Transaction, 'id' | 'createdAt' | 'month'> = {
      accountId: tx?.accountId ?? defaultAccountId ?? accounts?.[0]?.id ?? 1,
      date,
      amount: a,
      kind,
      description: desc,
      merchant: desc,
      categoryId:
        categoryId || (await categorize({ description: desc, merchant: desc, kind })) || undefined,
      notes: notes || undefined,
      tags: tags.length ? tags : undefined,
      importHash: tx?.importHash,
      source: tx?.source ?? 'manual',
      personalAmount: pa,
      splitPeople: isSplit && splitPeople ? Number(splitPeople) : undefined,
      splitNote: isSplit ? splitNote || undefined : undefined,
      reimbursementFor: kind === 'income' ? reimbursementFor : undefined,
    };

    if (tx?.id) {
      await db.transactions.update(tx.id, { ...base, month: monthKey(date) });
    } else {
      await db.transactions.add({ ...base, month: monthKey(date), createdAt: Date.now() });
    }
    onClose();
  }

  async function remove() {
    if (!tx?.id) return;
    if (!window.confirm('¿Eliminar este movimiento? No se puede deshacer.')) return;
    await db.transactions.delete(tx.id);
    onClose();
  }

  if (linkPicker) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Selecciona el gasto que esta devolución está reembolsando.
        </p>
        <div className="max-h-[50vh] scroll-area border border-border rounded-xl divide-y divide-border">
          {(pendingExpenses ?? []).map((e) => (
            <button
              key={e.id}
              onClick={() => {
                setReimbursementFor(e.id);
                setLinkPicker(false);
              }}
              className="press w-full text-left px-3 py-2.5 flex items-center justify-between"
            >
              <div>
                <p className="text-sm truncate">{e.merchant ?? e.description}</p>
                <p className="text-[11px] text-muted">
                  {formatDate(e.date)} · tu parte {formatMoney(e.personalAmount ?? e.amount)} de{' '}
                  {formatMoney(e.amount)}
                </p>
              </div>
              <Icon name="chevron-right" size={16} className="text-dim" />
            </button>
          ))}
          {(pendingExpenses?.length ?? 0) === 0 && (
            <p className="p-3 text-sm text-muted">No hay gastos compartidos pendientes.</p>
          )}
        </div>
        <Button variant="secondary" full onClick={() => setLinkPicker(false)}>
          Cancelar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <SegmentedControl
        value={kind}
        onChange={(v) => setKind(v as Transaction['kind'])}
        options={[
          { value: 'expense', label: 'Gasto' },
          { value: 'income', label: 'Ingreso' },
        ]}
      />
      <Input
        label="Descripción"
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Mercadona, Comida con amigos..."
        autoFocus={!isEdit}
      />
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Importe"
          type="number"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0,00"
        />
        <Input label="Fecha" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Select
        label="Categoría"
        value={categoryId}
        onChange={(e) => setCategoryId(Number(e.target.value))}
      >
        <option value={0}>Auto</option>
        {(kind === 'income' ? incomeCats : expenseCats).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </Select>

      {kind === 'expense' && (
        <div className="bg-elevated rounded-xl border border-border overflow-hidden">
          <label className="px-3 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Gasto compartido</p>
              <p className="text-[11px] text-muted">
                Marca cuánto fue tuyo cuando te lo devuelvan amigos.
              </p>
            </div>
            <input
              type="checkbox"
              checked={isSplit}
              onChange={(e) => setIsSplit(e.target.checked)}
              className="w-5 h-5 accent-accent"
            />
          </label>
          {isSplit && (
            <div className="px-3 pb-3 space-y-3 border-t border-border pt-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Tu parte (€)"
                  type="number"
                  inputMode="decimal"
                  value={personalAmount}
                  onChange={(e) => setPersonalAmount(e.target.value)}
                  placeholder="0,00"
                />
                <Input
                  label="Personas"
                  type="number"
                  inputMode="numeric"
                  value={splitPeople}
                  onChange={(e) => setSplitPeople(e.target.value)}
                  placeholder="4"
                  hint="Reparto a partes iguales"
                />
              </div>
              <Input
                label="Con quién (opcional)"
                value={splitNote}
                onChange={(e) => setSplitNote(e.target.value)}
                placeholder="Juan, Sara, Marta"
              />
            </div>
          )}
        </div>
      )}

      {kind === 'income' && (
        <div className="bg-elevated rounded-xl border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Devolución de un gasto</p>
              <p className="text-[11px] text-muted">
                Enlaza con un gasto compartido para que no cuente como ingreso.
              </p>
            </div>
            {reimbursementFor ? (
              <button
                className="press text-xs text-danger"
                onClick={() => setReimbursementFor(undefined)}
              >
                Quitar
              </button>
            ) : (
              <button
                className="press text-xs text-info flex items-center gap-1"
                onClick={() => setLinkPicker(true)}
              >
                <Icon name="link" size={14} /> Enlazar
              </button>
            )}
          </div>
          {reimbursementFor && (
            <p className="text-[11px] text-muted mt-2">Enlazado a gasto #{reimbursementFor}</p>
          )}
        </div>
      )}

      <Textarea
        label="Notas"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Opcional"
      />
      <Input
        label="Etiquetas"
        value={tagsText}
        onChange={(e) => setTagsText(e.target.value)}
        placeholder="viaje-japon, trabajo"
        hint="Separa por comas"
      />

      {error && <p className="text-danger text-sm">{error}</p>}
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
      {isEdit && (
        <Button variant="danger" full leading={<Icon name="trash" size={16} />} onClick={remove}>
          Eliminar
        </Button>
      )}
    </div>
  );
}
