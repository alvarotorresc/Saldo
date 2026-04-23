import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { db } from '@/db/database';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input, Select } from '@/ui/Input';
import { formatMoney } from '@/lib/format';
import { invalidateRulesCache } from '@/lib/categorize';
import type { Account, Budget, Category, Recurring } from '@/types';
import { useApp } from '@/stores/app';
import { detectRecurring } from '@/lib/recurring';

export function SettingsPage() {
  const month = useApp((s) => s.month);
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const budgets = useLiveQuery(
    () => db.budgets.where('month').anyOf([month, '*']).toArray(),
    [month],
  );
  const recurring = useLiveQuery(() => db.recurring.toArray(), []);

  const [accountSheet, setAccountSheet] = useState(false);
  const [budgetSheet, setBudgetSheet] = useState(false);

  async function runDetect() {
    await detectRecurring();
  }

  return (
    <>
      <TopBar title="Ajustes" />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        <Card padded={false}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold">Cuentas</h3>
            <button
              onClick={() => setAccountSheet(true)}
              className="text-xs text-muted press flex items-center gap-1"
            >
              <Icon name="plus" size={14} /> Añadir
            </button>
          </div>
          <ul className="divide-y divide-border">
            {accounts?.map((a) => (
              <li key={a.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm">{a.name}</p>
                  <p className="text-[11px] text-muted uppercase tracking-wider">
                    {a.bank === 'manual' ? 'Manual' : a.bank.toUpperCase()}
                  </p>
                </div>
                <span className="text-[11px] text-dim">{a.currency}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h3 className="text-sm font-semibold">Presupuestos</h3>
              <p className="text-[11px] text-muted">Límite mensual por categoría</p>
            </div>
            <button
              onClick={() => setBudgetSheet(true)}
              className="text-xs text-muted press flex items-center gap-1"
            >
              <Icon name="plus" size={14} /> Añadir
            </button>
          </div>
          {budgets && budgets.length > 0 ? (
            <ul className="divide-y divide-border">
              {budgets.map((b) => {
                const cat = categories?.find((c) => c.id === b.categoryId);
                return (
                  <li key={b.id} className="px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {cat && (
                        <span className="w-2 h-2 rounded-full" style={{ background: cat.color }} />
                      )}
                      <span className="text-sm">{cat?.name ?? '—'}</span>
                      {b.month === '*' && <span className="chip text-[10px]">Todos los meses</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm tabular">{formatMoney(b.amount)}</span>
                      <button
                        onClick={() => b.id && db.budgets.delete(b.id)}
                        className="text-dim press"
                        aria-label="Eliminar"
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="px-4 pb-4">
              <p className="text-sm text-muted">Sin presupuestos definidos.</p>
            </div>
          )}
        </Card>

        <Card padded={false}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <div>
              <h3 className="text-sm font-semibold">Gastos recurrentes</h3>
              <p className="text-[11px] text-muted">Detectados automáticamente</p>
            </div>
            <button
              onClick={runDetect}
              className="text-xs text-muted press flex items-center gap-1"
            >
              <Icon name="repeat" size={14} /> Redetectar
            </button>
          </div>
          <RecurringList items={recurring ?? []} categories={categories ?? []} />
        </Card>

        <Card>
          <h3 className="text-sm font-semibold">Datos</h3>
          <p className="text-xs text-muted mt-1">
            Todo se guarda en este dispositivo. Puedes exportar un backup JSON.
          </p>
          <div className="grid grid-cols-2 gap-2 mt-3">
            <Button variant="secondary" onClick={exportBackup}>
              Backup JSON
            </Button>
            <Button variant="secondary" onClick={exportCSV}>
              Export CSV
            </Button>
            <label className="press inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-elevated border border-border text-sm font-medium cursor-pointer col-span-2">
              Importar backup JSON
              <input
                type="file"
                accept="application/json"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) await importBackup(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </Card>

        <div className="text-center pt-4 pb-8">
          <p className="text-[11px] text-dim">Saldo · offline first · v0.1.0</p>
        </div>
      </div>

      <Sheet open={accountSheet} onClose={() => setAccountSheet(false)} title="Nueva cuenta">
        <AccountForm onClose={() => setAccountSheet(false)} />
      </Sheet>
      <Sheet open={budgetSheet} onClose={() => setBudgetSheet(false)} title="Nuevo presupuesto">
        <BudgetForm
          month={month}
          categories={categories ?? []}
          onClose={() => setBudgetSheet(false)}
        />
      </Sheet>
    </>
  );
}

function RecurringList({ items, categories }: { items: Recurring[]; categories: Category[] }) {
  if (items.length === 0) {
    return (
      <div className="px-4 pb-4">
        <p className="text-sm text-muted">Añade más movimientos para detectar pagos recurrentes.</p>
      </div>
    );
  }
  const byCat = (id?: number) => categories.find((c) => c.id === id);
  return (
    <ul className="divide-y divide-border">
      {items.slice(0, 20).map((r) => {
        const cat = byCat(r.categoryId);
        return (
          <li key={r.id} className="px-4 py-3 flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full grid place-items-center shrink-0"
              style={{
                background: (cat?.color ?? '#2A2A30') + '22',
                color: cat?.color ?? '#8A8A93',
              }}
            >
              <Icon name="repeat" size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm truncate capitalize">{r.signature}</p>
              <p className="text-[11px] text-muted">
                ~cada {r.cadenceDays} días · {r.sampleCount} pagos
              </p>
            </div>
            <span
              className={`text-sm tabular ${r.kind === 'expense' ? 'text-danger' : 'text-accent'}`}
            >
              {r.kind === 'expense' ? '-' : '+'}
              {formatMoney(r.averageAmount)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function AccountForm({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [bank, setBank] = useState<Account['bank']>('manual');

  async function save() {
    if (!name) return;
    await db.accounts.add({
      name,
      bank,
      currency: 'EUR',
      createdAt: Date.now(),
    });
    onClose();
  }

  return (
    <div className="space-y-3">
      <Input
        label="Nombre"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="N26 principal"
        autoFocus
      />
      <Select
        label="Banco"
        value={bank}
        onChange={(e) => setBank(e.target.value as Account['bank'])}
      >
        <option value="manual">Manual</option>
        <option value="n26">N26</option>
        <option value="bbva">BBVA</option>
        <option value="other">Otro</option>
      </Select>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

function BudgetForm({
  month,
  categories,
  onClose,
}: {
  month: string;
  categories: Category[];
  onClose: () => void;
}) {
  const [categoryId, setCategoryId] = useState<number>(0);
  const [amount, setAmount] = useState('');
  const [monthScope, setMonthScope] = useState<'current' | 'all'>('all');

  async function save() {
    const n = Number(amount);
    if (!categoryId || !Number.isFinite(n) || n <= 0) return;
    const budget: Omit<Budget, 'id'> = {
      month: monthScope === 'all' ? '*' : month,
      categoryId,
      amount: n,
      createdAt: Date.now(),
    };
    await db.budgets.add(budget);
    invalidateRulesCache();
    onClose();
  }

  return (
    <div className="space-y-3">
      <Select
        label="Categoría"
        value={categoryId}
        onChange={(e) => setCategoryId(Number(e.target.value))}
      >
        <option value={0}>Elige una...</option>
        {categories
          .filter((c) => c.kind === 'expense')
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </Select>
      <Input
        label="Importe mensual (€)"
        type="number"
        inputMode="decimal"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="300"
      />
      <Select
        label="Aplica a"
        value={monthScope}
        onChange={(e) => setMonthScope(e.target.value as 'current' | 'all')}
      >
        <option value="all">Todos los meses</option>
        <option value="current">Solo este mes</option>
      </Select>
      <div className="flex gap-2 pt-2">
        <Button variant="secondary" full onClick={onClose}>
          Cancelar
        </Button>
        <Button variant="primary" full onClick={save}>
          Guardar
        </Button>
      </div>
    </div>
  );
}

async function exportBackup() {
  const [
    accounts,
    categoryGroups,
    categories,
    transactions,
    budgets,
    goals,
    recurring,
    rules,
    subscriptions,
    loans,
    balances,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.categoryGroups.toArray(),
    db.categories.toArray(),
    db.transactions.toArray(),
    db.budgets.toArray(),
    db.goals.toArray(),
    db.recurring.toArray(),
    db.rules.toArray(),
    db.subscriptions.toArray(),
    db.loans.toArray(),
    db.balances.toArray(),
  ]);
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    accounts,
    categoryGroups,
    categories,
    transactions,
    budgets,
    goals,
    recurring,
    rules,
    subscriptions,
    loans,
    balances,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldo-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function exportCSV() {
  const txs = await db.transactions.orderBy('date').toArray();
  const cats = await db.categories.toArray();
  const catById = new Map(cats.map((c) => [c.id, c.name] as const));
  const header = [
    'Fecha',
    'Descripción',
    'Comercio',
    'Importe',
    'Tipo',
    'Categoría',
    'Tu parte',
    'Notas',
    'Etiquetas',
  ];
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const rows = txs.map((t) => [
    t.date,
    t.description,
    t.merchant ?? '',
    (t.kind === 'expense' ? '-' : t.kind === 'income' ? '+' : '') + t.amount.toFixed(2),
    t.kind,
    catById.get(t.categoryId ?? -1) ?? '',
    t.personalAmount != null ? t.personalAmount.toFixed(2) : '',
    t.notes ?? '',
    (t.tags ?? []).join('|'),
  ]);
  const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `saldo-transacciones-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

async function importBackup(file: File) {
  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate version: must be a known string or a supported numeric (1 or 2)
    const version = data?.version;
    const versionStr = typeof version === 'string' ? version : String(version ?? '');
    const versionOk =
      (typeof version === 'number' && (version === 1 || version === 2)) ||
      (typeof version === 'string' &&
        (versionStr.startsWith('1') || versionStr.startsWith('0.1') || versionStr === '2'));
    if (!versionOk) {
      throw new Error(
        `Versión de backup no soportada: "${versionStr || 'desconocida'}". Esperado 1 o 2.`,
      );
    }

    // Validate shape: at least one known array field must exist and all provided must be arrays
    const arrayFields = [
      'accounts',
      'categoryGroups',
      'categories',
      'transactions',
      'budgets',
      'goals',
      'recurring',
      'rules',
      'subscriptions',
      'loans',
      'balances',
    ] as const;
    let seen = 0;
    for (const f of arrayFields) {
      if (data[f] !== undefined) {
        if (!Array.isArray(data[f])) {
          throw new Error(`Campo "${f}" no es un array válido.`);
        }
        seen++;
      }
    }
    if (seen === 0) {
      throw new Error('El backup no contiene datos reconocibles.');
    }

    // Invalidate BEFORE the write to prevent any in-flight categorize() from using stale rules.
    invalidateRulesCache();

    await db.transaction('rw', db.tables, async () => {
      if (Array.isArray(data.accounts)) await db.accounts.bulkPut(data.accounts);
      if (Array.isArray(data.categoryGroups)) await db.categoryGroups.bulkPut(data.categoryGroups);
      if (Array.isArray(data.categories)) await db.categories.bulkPut(data.categories);
      if (Array.isArray(data.transactions)) await db.transactions.bulkPut(data.transactions);
      if (Array.isArray(data.budgets)) await db.budgets.bulkPut(data.budgets);
      if (Array.isArray(data.goals)) await db.goals.bulkPut(data.goals);
      if (Array.isArray(data.recurring)) await db.recurring.bulkPut(data.recurring);
      if (Array.isArray(data.rules)) await db.rules.bulkPut(data.rules);
      if (Array.isArray(data.subscriptions)) await db.subscriptions.bulkPut(data.subscriptions);
      if (Array.isArray(data.loans)) await db.loans.bulkPut(data.loans);
      if (Array.isArray(data.balances)) await db.balances.bulkPut(data.balances);
    });
    invalidateRulesCache();
  } catch (e) {
    console.error('Backup inválido', e);
    const msg = e instanceof Error ? e.message : 'Archivo inválido o corrupto.';
    window.alert(`No se pudo restaurar el backup: ${msg}`);
  }
}
