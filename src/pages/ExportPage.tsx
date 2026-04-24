/**
 * ExportPage — F11 rewrite (ScrExport). 5 formatos: .saldo (snapshot v2
 * completo con tombstones), .csv (RFC-4180), .json (snapshot readable), .ofx
 * (SGML 1.x) y .pdf (generado con jspdf).
 */
import { jsPDF } from 'jspdf';
import { useState } from 'react';
import { db } from '@/db/database';
import { serializeSnapshot, type SaldoSnapshot } from '@/lib/saldoFile';
import { transactionsToCsv, transactionsToOfx } from '@/lib/exportFormats';
import { formatMoney } from '@/lib/format';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Btn, Section } from '@/ui/primitives';
import type { Transaction } from '@/types';

interface Props {
  onBack: () => void;
}

type Format = 'saldo' | 'json' | 'csv' | 'ofx' | 'pdf';

const FORMATS: { key: Format; label: string; desc: string; ext: string; recommended?: boolean }[] =
  [
    {
      key: 'saldo',
      label: '.saldo',
      desc: 'Snapshot completo · incluye tombstones y reglas',
      ext: 'saldo.json',
      recommended: true,
    },
    { key: 'json', label: '.json', desc: 'Estructura readable · para devs', ext: 'json' },
    { key: 'csv', label: '.csv', desc: 'Estándar RFC-4180 · Excel / Sheets', ext: 'csv' },
    { key: 'ofx', label: '.ofx', desc: 'Open Financial Exchange · YNAB / GnuCash', ext: 'ofx' },
    { key: 'pdf', label: '.pdf', desc: 'Informe imprimible · resumen mensual', ext: 'pdf' },
  ];

async function buildSnapshot(): Promise<SaldoSnapshot> {
  return {
    version: 2,
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
    txTombstones: await db.txTombstones.toArray(),
  };
}

export function ExportPage({ onBack }: Props) {
  const [format, setFormat] = useState<Format>('saldo');
  const [status, setStatus] = useState<'idle' | 'working' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function exportNow() {
    setStatus('working');
    setError(null);
    try {
      const fdef = FORMATS.find((f) => f.key === format)!;
      const filename = `saldo-export-${new Date().toISOString().slice(0, 10)}.${fdef.ext}`;
      let blob: Blob;

      if (format === 'saldo' || format === 'json') {
        const payload = serializeSnapshot(await buildSnapshot());
        blob = new Blob([payload], { type: 'application/json' });
      } else if (format === 'csv') {
        const [txs, cats] = await Promise.all([
          db.transactions.orderBy('date').toArray(),
          db.categories.toArray(),
        ]);
        const catById = new Map(cats.map((c) => [c.id ?? -1, { name: c.name }]));
        blob = new Blob([transactionsToCsv(txs, catById)], { type: 'text/csv' });
      } else if (format === 'ofx') {
        const [txs, accounts] = await Promise.all([
          db.transactions.orderBy('date').toArray(),
          db.accounts.toArray(),
        ]);
        const ofx = transactionsToOfx(txs, {
          bankId: 'SALDO',
          acctId: accounts[0]?.name?.slice(0, 22) ?? 'LOCAL',
          curdef: 'EUR',
        });
        blob = new Blob([ofx], { type: 'application/x-ofx' });
      } else {
        // pdf
        const [txs, cats] = await Promise.all([
          db.transactions.orderBy('date').reverse().toArray(),
          db.categories.toArray(),
        ]);
        const catById = new Map(cats.map((c) => [c.id ?? -1, c.name]));
        blob = await buildPdf(txs, catById);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
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
      <TopBarV2 title="saldo@local" sub="EXPORT · BACKUP" onBack={onBack} />
      <div className="scroll-area flex-1 pb-6" data-testid="export-page">
        <Section title="FORMAT">
          <ul className="space-y-1.5">
            {FORMATS.map((f) => {
              const active = format === f.key;
              return (
                <li key={f.key}>
                  <button
                    type="button"
                    onClick={() => setFormat(f.key)}
                    aria-pressed={active}
                    data-testid={`export-format-${f.key}`}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 border rounded-xs press',
                      active ? 'border-accent bg-surface' : 'border-border bg-transparent',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'w-[26px] h-[26px] border border-borderStrong rounded-xs grid place-items-center font-mono text-[10px]',
                        active ? 'text-accent' : 'text-muted',
                      ].join(' ')}
                    >
                      {active ? '●' : '○'}
                    </span>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="font-mono text-mono12 text-text">
                        {f.label}
                        {f.recommended && (
                          <span className="ml-1.5 text-mono9 text-accent tracking-widest">
                            RECOMENDADO
                          </span>
                        )}
                      </div>
                      <div className="font-mono text-mono9 text-dim mt-0.5 truncate">{f.desc}</div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section title="WARNING">
          <p className="font-mono text-mono10 text-warning">
            El archivo contiene TODAS tus transacciones en texto plano
            {format === 'saldo' || format === 'json' ? ' (incluyendo tombstones y reglas)' : ''}.
            Guárdalo en un sitio seguro; no lo compartas.
          </p>
        </Section>

        <div className="px-3.5 py-3">
          <Btn variant="solid" block onClick={exportNow} disabled={status === 'working'}>
            {status === 'working' ? 'EXPORTING…' : `EXPORT ${format.toUpperCase()}`}
          </Btn>
          {status === 'done' && (
            <p className="mt-2 font-mono text-mono9 text-accent">archivo descargado</p>
          )}
          {status === 'error' && <p className="mt-2 font-mono text-mono9 text-danger">✗ {error}</p>}
        </div>
      </div>
    </>
  );
}

async function buildPdf(txs: readonly Transaction[], catById: Map<number, string>): Promise<Blob> {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;

  doc.setFont('courier', 'bold');
  doc.setFontSize(16);
  doc.text('SALDO · LEDGER EXPORT', margin, 56);
  doc.setFont('courier', 'normal');
  doc.setFontSize(9);
  doc.text(`generado ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`, margin, 72);
  doc.text(`transacciones: ${txs.length}`, margin, 86);

  let y = 110;
  const rowH = 14;
  doc.setFontSize(9);
  doc.setFont('courier', 'bold');
  doc.text('DATE', margin, y);
  doc.text('KIND', margin + 80, y);
  doc.text('AMOUNT', margin + 130, y);
  doc.text('MERCHANT', margin + 200, y);
  doc.text('CATEGORY', margin + 380, y);
  doc.setFont('courier', 'normal');
  y += rowH;
  doc.setLineWidth(0.5);
  doc.line(margin, y - 8, pageWidth - margin, y - 8);

  for (const t of txs) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin + 20;
    }
    const amt = t.kind === 'expense' ? -Math.abs(t.amount) : t.amount;
    const cat = t.categoryId ? (catById.get(t.categoryId) ?? '—') : '—';
    doc.text(t.date, margin, y);
    doc.text(t.kind.slice(0, 3).toUpperCase(), margin + 80, y);
    doc.text(formatMoney(amt).slice(0, 10), margin + 130, y);
    doc.text((t.merchant ?? t.description ?? '').slice(0, 30), margin + 200, y);
    doc.text(cat.slice(0, 24), margin + 380, y);
    y += rowH;
  }

  return doc.output('blob');
}
