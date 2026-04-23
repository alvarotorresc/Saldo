import { useLiveQuery } from 'dexie-react-hooks';
import { useRef, useState } from 'react';
import { db } from '@/db/database';
import { parseStatement, toTransaction, type ImportResult } from '@/lib/importers';
import { categorize } from '@/lib/categorize';
import { detectRecurring } from '@/lib/recurring';
import { TopBar } from '@/ui/TopBar';
import { Card } from '@/ui/Card';
import { Button } from '@/ui/Button';
import { Icon } from '@/ui/Icon';
import { Select } from '@/ui/Input';
import { formatDate, formatMoney } from '@/lib/format';

export function ImportPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [accountId, setAccountId] = useState<number>(0);
  const [forcedBank, setForcedBank] = useState<'auto' | 'n26' | 'bbva'>('auto');
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<{ added: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const accounts = useLiveQuery(() => db.accounts.toArray(), []);

  async function onFile(file: File) {
    setError(null);
    setSummary(null);
    try {
      const text = await file.text();
      const parsed = parseStatement(text);
      if (forcedBank !== 'auto') parsed.bank = forcedBank;
      setResult(parsed);
      if (parsed.rows.length === 0) {
        setError('No se ha podido leer ningún movimiento. ¿El formato es correcto?');
      }
      if (!accountId && accounts && accounts[0]?.id) setAccountId(accounts[0].id);
    } catch (e) {
      setError('Error al leer el archivo: ' + (e as Error).message);
    }
  }

  async function doImport() {
    if (!result) return;
    const accId = accountId || accounts?.[0]?.id;
    if (!accId) {
      setError('Selecciona una cuenta');
      return;
    }
    setRunning(true);
    let added = 0;
    let skipped = 0;
    try {
      await db.transaction(
        'rw',
        [db.transactions, db.rules, db.categories, db.categoryGroups],
        async () => {
          for (const row of result.rows) {
            const base = toTransaction(accId, result.bank, row);
            if (base.importHash) {
              const exists = await db.transactions
                .where('[accountId+importHash]')
                .equals([accId, base.importHash])
                .first();
              if (exists) {
                skipped++;
                continue;
              }
            }
            const catId = await categorize({
              description: base.description,
              merchant: base.merchant,
              kind: base.kind,
            });
            await db.transactions.add({ ...base, categoryId: catId });
            added++;
          }
        },
      );
      await detectRecurring();
      setSummary({ added, skipped });
      setResult(null);
    } catch (e) {
      setError('Error durante la importación: ' + (e as Error).message);
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <TopBar title="Importar" subtitle="Extractos de N26 y BBVA" />
      <div className="scroll-area flex-1 px-4 pb-6 space-y-4">
        <Card>
          <h3 className="text-sm font-semibold">Banco</h3>
          <p className="text-xs text-muted mt-1">
            Si lo dejas en auto, Saldo detecta el formato. Si falla, fuérzalo manualmente.
          </p>
          <div className="mt-3">
            <Select
              value={forcedBank}
              onChange={(e) => setForcedBank(e.target.value as typeof forcedBank)}
            >
              <option value="auto">Auto detectar</option>
              <option value="n26">N26</option>
              <option value="bbva">BBVA</option>
            </Select>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-semibold">Cuenta destino</h3>
          <div className="mt-3">
            <Select value={accountId} onChange={(e) => setAccountId(Number(e.target.value))}>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </Card>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />

        <Button
          variant="primary"
          full
          size="lg"
          leading={<Icon name="import" size={18} />}
          onClick={() => fileRef.current?.click()}
        >
          Elegir archivo CSV
        </Button>

        {error && (
          <Card className="border-danger/30 bg-dangerDim/40">
            <div className="flex items-start gap-2">
              <Icon name="alert" size={18} className="text-danger mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          </Card>
        )}

        {summary && (
          <Card className="border-accent/30">
            <div className="flex items-start gap-2">
              <Icon name="check" size={18} className="text-accent mt-0.5" />
              <div>
                <p className="text-sm font-medium">Importación completada</p>
                <p className="text-xs text-muted mt-1 tabular">
                  Añadidos: {summary.added} · Duplicados omitidos: {summary.skipped}
                </p>
              </div>
            </div>
          </Card>
        )}

        {result && (
          <Card>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Previsualización
                <span className="ml-2 chip">{result.bank.toUpperCase()}</span>
              </h3>
              <span className="text-xs text-muted tabular">
                {result.rows.length} válidas · {result.skipped} ignoradas
              </span>
            </div>
            <div className="mt-3 max-h-72 scroll-area -mx-4 px-4 divide-y divide-border">
              {result.rows.slice(0, 50).map((r, i) => (
                <div key={i} className="py-2 flex items-center justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{r.description}</p>
                    <p className="text-[11px] text-muted">{formatDate(r.date)}</p>
                  </div>
                  <span className={`tabular ${r.amount < 0 ? 'text-danger' : 'text-accent'}`}>
                    {r.amount < 0 ? '-' : '+'}
                    {formatMoney(Math.abs(r.amount))}
                  </span>
                </div>
              ))}
              {result.rows.length > 50 && (
                <p className="py-2 text-xs text-muted text-center">
                  ...y {result.rows.length - 50} más
                </p>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" full onClick={() => setResult(null)}>
                Cancelar
              </Button>
              <Button variant="primary" full onClick={doImport} disabled={running || !result}>
                {running ? 'Importando...' : `Importar ${result.rows.length}`}
              </Button>
            </div>
          </Card>
        )}

        <Card>
          <h3 className="text-sm font-semibold">Cómo exportar desde tu banco</h3>
          <ul className="mt-2 space-y-2 text-xs text-muted">
            <li>
              <b className="text-text">N26:</b> app → Movimientos → Ajustes → Exportar CSV.
            </li>
            <li>
              <b className="text-text">BBVA:</b> web bbva.es → Posición global → Cuenta →
              Movimientos → icono de descarga → CSV.
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
