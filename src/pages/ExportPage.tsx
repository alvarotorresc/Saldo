/**
 * ExportPage — F8 terminal-style export. Writes a `.saldo.json` snapshot with
 * every Dexie table included. Formats CSV/OFX/PDF están diferidos (ver
 * memoria saldo-redesign-v2-progress.md §F8).
 */
import { useState } from 'react';
import { db } from '@/db/database';
import { serializeSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Btn, Section } from '@/ui/primitives';

interface Props {
  onBack: () => void;
}

type Format = 'saldo' | 'json';

export function ExportPage({ onBack }: Props) {
  const [format, setFormat] = useState<Format>('saldo');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function exportNow() {
    setStatus('working');
    setError(null);
    try {
      const snapshot: SaldoSnapshot = {
        version: 1,
        exportedAt: new Date().toISOString(),
        accounts: await db.accounts.toArray(),
        categoryGroups: await db.categoryGroups.toArray(),
        categories: await db.categories.toArray(),
        transactions: await db.transactions.toArray(),
        budgets: await db.budgets.toArray(),
        goals: await db.goals.toArray(),
        rules: await db.rules.toArray(),
        subscriptions: await db.subscriptions.toArray(),
        loans: await db.loans.toArray(),
        balances: await db.balances.toArray(),
      };
      const payload = serializeSnapshot(snapshot);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ext = format === 'saldo' ? 'saldo.json' : 'json';
      a.href = url;
      a.download = `saldo-export-${new Date().toISOString().slice(0, 10)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('error');
    }
  }

  return (
    <>
      <TopBarV2 title="export" onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="export-page">
        <Section title="FORMAT">
          <div className="flex gap-2">
            {(['saldo', 'json'] as Format[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                aria-pressed={format === f}
                data-testid={`export-format-${f}`}
                className={[
                  'flex-1 py-2 font-mono text-mono11 tracking-widest border rounded-xs press',
                  format === f
                    ? 'bg-surface text-accent border-accent'
                    : 'bg-transparent text-muted border-border',
                ].join(' ')}
              >
                .{f}
              </button>
            ))}
          </div>
          <p className="mt-2 font-mono text-mono9 text-dim">
            CSV/OFX/PDF vendrán en versiones posteriores.
          </p>
        </Section>

        <Section title="WARNING">
          <p className="font-mono text-mono10 text-warning">
            El archivo contiene TODAS tus transacciones en texto plano. Guárdalo en un sitio seguro;
            no lo compartas.
          </p>
        </Section>

        <div className="px-3.5 py-3">
          <Btn variant="solid" block onClick={exportNow} disabled={status === 'working'}>
            {status === 'working' ? 'EXPORTING…' : 'EXPORT'}
          </Btn>
          {status === 'done' && (
            <p className="mt-2 font-mono text-mono9 text-accent">✓ archivo descargado</p>
          )}
          {status === 'error' && <p className="mt-2 font-mono text-mono9 text-danger">✗ {error}</p>}
        </div>
      </div>
    </>
  );
}
