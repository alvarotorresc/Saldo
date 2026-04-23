import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { db } from '@/db/database';
import { formatMoney, formatMonth, formatMonthShort, shiftMonth, currentMonth } from '@/lib/format';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Sheet } from '@/ui/Sheet';
import { Input, Select } from '@/ui/Input';
import { LineChart } from '@/ui/charts/LineChart';
import { EmptyState } from '@/ui/EmptyState';

interface Props {
  onBack: () => void;
}

export function WealthPage({ onBack }: Props) {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const balances = useLiveQuery(() => db.balances.toArray(), []);
  const [sheetOpen, setSheetOpen] = useState(false);

  const latestByAccount = useMemo(() => {
    const map = new Map<number, number>();
    for (const b of balances ?? []) {
      const cur = map.get(b.accountId);
      if (cur == null) map.set(b.accountId, b.balance);
      else map.set(b.accountId, cur);
    }
    const latest = new Map<number, { month: string; balance: number }>();
    for (const b of balances ?? []) {
      const cur = latest.get(b.accountId);
      if (!cur || b.month > cur.month)
        latest.set(b.accountId, { month: b.month, balance: b.balance });
    }
    return latest;
  }, [balances]);

  const total = useMemo(() => {
    let s = 0;
    latestByAccount.forEach((v) => (s += v.balance));
    return s;
  }, [latestByAccount]);

  const series = useMemo(() => {
    const now = currentMonth();
    const months: string[] = [];
    for (let i = 11; i >= 0; i--) months.push(shiftMonth(now, -i));
    const perAccountMonth = new Map<string, number>();
    (balances ?? []).forEach((b) => perAccountMonth.set(`${b.accountId}-${b.month}`, b.balance));
    // For each month, sum per account using the last known balance as carry-forward
    const lastPerAcc = new Map<number, number>();
    return months.map((m) => {
      let sum = 0;
      for (const a of accounts ?? []) {
        if (!a.id) continue;
        const key = `${a.id}-${m}`;
        if (perAccountMonth.has(key)) lastPerAcc.set(a.id, perAccountMonth.get(key)!);
        sum += lastPerAcc.get(a.id) ?? 0;
      }
      return { x: formatMonthShort(m), y: sum };
    });
  }, [balances, accounts]);

  return (
    <>
      <TopBar
        title="Patrimonio"
        subtitle={total > 0 ? formatMoney(total) : 'Registra saldos de cuentas'}
        leading={
          <button onClick={onBack} className="press text-muted" aria-label="Atrás">
            <Icon name="chevron-left" />
          </button>
        }
        trailing={
          <button
            onClick={() => setSheetOpen(true)}
            className="press w-9 h-9 rounded-full bg-text text-bg grid place-items-center"
            aria-label="Apuntar saldo"
          >
            <Icon name="plus" />
          </button>
        }
      />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        {latestByAccount.size === 0 ? (
          <EmptyState
            title="Sin saldos"
            description="Apunta el saldo de tus cuentas cada mes para ver la evolución."
            action={
              <Button variant="primary" onClick={() => setSheetOpen(true)}>
                Apuntar saldo
              </Button>
            }
          />
        ) : (
          <>
            <Card>
              <p className="text-xs text-muted uppercase tracking-wider">Patrimonio neto</p>
              <p className="text-3xl font-semibold tabular mt-1">{formatMoney(total)}</p>
            </Card>
            <Card>
              <h3 className="text-sm font-semibold mb-2">Evolución (12 meses)</h3>
              <LineChart
                series={[{ label: 'Patrimonio', values: series, color: '#34D399', fill: true }]}
                formatY={(n) => formatMoney(n)}
              />
            </Card>
            <Card padded={false}>
              <div className="px-4 pt-4 pb-2">
                <h3 className="text-sm font-semibold">Por cuenta</h3>
              </div>
              <ul className="divide-y divide-border">
                {(accounts ?? []).map((a) => {
                  if (!a.id) return null;
                  const b = latestByAccount.get(a.id);
                  return (
                    <li key={a.id} className="px-4 py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm">{a.name}</p>
                        <p className="text-[11px] text-muted uppercase tracking-wider">
                          {a.bank === 'manual' ? 'Manual' : a.bank.toUpperCase()}
                          {b && ` · ${formatMonth(b.month)}`}
                        </p>
                      </div>
                      <span className="text-sm tabular font-medium">
                        {b ? formatMoney(b.balance) : '—'}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </>
        )}
      </div>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Apuntar saldo">
        <BalanceForm accounts={accounts ?? []} onClose={() => setSheetOpen(false)} />
      </Sheet>
    </>
  );
}

function BalanceForm({
  accounts,
  onClose,
}: {
  accounts: { id?: number; name: string }[];
  onClose: () => void;
}) {
  const [accountId, setAccountId] = useState<number>(accounts[0]?.id ?? 0);
  const [month, setMonth] = useState(currentMonth());
  const [balance, setBalance] = useState('');

  async function save() {
    const b = Number(balance);
    if (!accountId || !Number.isFinite(b)) return;
    const existing = await db.balances
      .where('[accountId+month]')
      .equals([accountId, month])
      .first();
    if (existing?.id) {
      await db.balances.update(existing.id, { balance: b });
    } else {
      await db.balances.add({
        accountId,
        month,
        balance: b,
        createdAt: Date.now(),
      });
    }
    onClose();
  }

  return (
    <div className="space-y-3">
      <Select
        label="Cuenta"
        value={accountId}
        onChange={(e) => setAccountId(Number(e.target.value))}
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </Select>
      <Input label="Mes" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <Input
        label="Saldo (€)"
        type="number"
        inputMode="decimal"
        value={balance}
        onChange={(e) => setBalance(e.target.value)}
        placeholder="1234,56"
      />
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
