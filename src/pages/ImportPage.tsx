/**
 * ImportPage — F10 rewrite (ScrImport). Terminal-style import con detección
 * automática de banco, column mapping preview, preview table con score de
 * confidence por fila (filas <0.8 en warning), y acción IMPORTAR que aplica
 * categorize() sobre cada fila antes de persistir.
 */
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { db } from '@/db/database';
import { categorize, invalidateRulesCache } from '@/lib/categorize';
import { parseStatement, toTransaction, type ImportResult, type ParsedRow } from '@/lib/importers';
import { importConfidence } from '@/lib/importConfidence';
import { formatMoney } from '@/lib/format';
import { TopBarV2 } from '@/ui/TopBarV2';
import { Icon } from '@/ui/Icon';
import { Badge, Btn, Section } from '@/ui/primitives';
import type { Bank, Category } from '@/types';

type Phase = 'idle' | 'preview' | 'importing' | 'done' | 'error';

interface PreviewRow {
  row: ParsedRow;
  confidence: number;
  predictedCategoryId?: number;
}

export function ImportPage() {
  const accounts = useLiveQuery(() => db.accounts.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [filename, setFilename] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState<number>(0);

  const catById = useMemo(() => {
    const m = new Map<number, Category>();
    (categories ?? []).forEach((c) => c.id && m.set(c.id, c));
    return m;
  }, [categories]);

  async function onPick(file: File) {
    setError(null);
    setFilename(file.name);
    try {
      const text = await file.text();
      const parsed = parseStatement(text);
      setResult(parsed);
      const prevs: PreviewRow[] = await Promise.all(
        parsed.rows.map(async (r) => {
          const kind: 'expense' | 'income' = r.amount < 0 ? 'expense' : 'income';
          const predicted = await categorize({
            description: r.description,
            merchant: r.merchant,
            kind,
          });
          return {
            row: r,
            confidence: importConfidence({
              date: r.date,
              amount: Math.abs(r.amount),
              description: r.description,
              merchant: r.merchant,
              kind,
            }),
            predictedCategoryId: predicted,
          };
        }),
      );
      setPreview(prevs);
      setPhase('preview');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  async function doImport() {
    if (!result || !accounts?.[0]?.id) return;
    setPhase('importing');
    try {
      const accountId = accounts[0].id;
      let added = 0;
      await db.transaction('rw', db.transactions, async () => {
        for (const p of preview) {
          const payload = toTransaction(accountId, result.bank, p.row);
          payload.categoryId = p.predictedCategoryId;
          const exists = payload.importHash
            ? await db.transactions
                .where('[accountId+importHash]')
                .equals([accountId, payload.importHash])
                .first()
            : undefined;
          if (exists) continue;
          await db.transactions.add(payload);
          added++;
        }
      });
      setImported(added);
      setPhase('done');
      invalidateRulesCache();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  const warningCount = preview.filter((p) => p.confidence < 0.8).length;
  const okCount = preview.length - warningCount;

  return (
    <>
      <TopBarV2
        title="saldo@local"
        sub="IMPORT"
        right={
          phase === 'preview' ? (
            <Badge tone={warningCount === 0 ? 'ok' : 'warn'}>
              {okCount} OK · {warningCount} REVIEW
            </Badge>
          ) : null
        }
      />
      <div className="scroll-area flex-1 pb-6" data-testid="import-page">
        {phase === 'idle' && (
          <div className="px-3.5 py-6 flex flex-col items-center text-center">
            <div className="font-mono text-mono10 text-dim tracking-widest uppercase mb-3">
              CSV · N26 / BBVA / generic
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              data-testid="import-file-input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onPick(f);
              }}
            />
            <Btn variant="solid" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" size={13} /> ELEGIR_CSV
            </Btn>
            <p className="mt-3 font-mono text-mono9 text-dim max-w-xs">
              El archivo se procesa en tu dispositivo. No sale de Saldo.
            </p>
          </div>
        )}

        {(phase === 'preview' || phase === 'importing' || phase === 'done') && result && (
          <>
            {/* Source */}
            <section className="px-3.5 py-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <span className="w-[34px] h-[34px] border border-border bg-surface rounded-xs grid place-items-center shrink-0">
                  <Icon name="file" size={14} className="text-accent" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-mono12 text-text truncate">{filename}</div>
                  <div className="font-mono text-mono9 text-dim mt-0.5">
                    {result.totalLines} filas · {result.rows.length} válidas · {result.skipped}{' '}
                    saltadas
                  </div>
                </div>
                <BankBadge bank={result.bank} />
              </div>
            </section>

            {/* Preview table */}
            <div className="px-3.5 py-2.5 bg-surface border-b border-border font-mono text-mono9 text-dim tracking-widest uppercase">
              PREVIEW · primeras {Math.min(20, preview.length)} filas
            </div>
            <ul>
              {preview.slice(0, 20).map((p, i) => {
                const low = p.confidence < 0.8;
                const amount = Math.abs(p.row.amount);
                const isIncome = p.row.amount > 0;
                const cat = p.predictedCategoryId ? catById.get(p.predictedCategoryId) : undefined;
                return (
                  <li
                    key={i}
                    className={[
                      'px-3.5 py-2 border-b border-border',
                      low ? 'bg-[rgba(212,165,106,.06)]' : '',
                    ].join(' ')}
                    data-testid={`preview-row-${i}`}
                  >
                    <div className="flex justify-between font-mono text-[10.5px] mb-0.5">
                      <span className="text-dim">{p.row.date}</span>
                      <span className={isIncome ? 'text-accent' : 'text-text'}>
                        {isIncome ? '+' : '−'}
                        {formatMoney(amount)}
                      </span>
                    </div>
                    <div className="flex justify-between font-mono text-[10px] items-center gap-2">
                      <span className="text-text truncate">{p.row.description}</span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <span className={low ? 'text-warning' : 'text-muted'}>
                          {cat?.name ?? '???'}
                        </span>
                        <span className={low ? 'text-warning' : 'text-dim'}>
                          {Math.round(p.confidence * 100)}%
                        </span>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {phase === 'preview' && (
              <Section title="ACTIONS">
                <div className="flex gap-2">
                  <Btn
                    variant="outline"
                    block
                    onClick={() => {
                      setResult(null);
                      setPreview([]);
                      setPhase('idle');
                    }}
                  >
                    CANCELAR
                  </Btn>
                  <Btn variant="solid" block onClick={doImport} data-testid="import-commit">
                    IMPORTAR {preview.length} TX
                  </Btn>
                </div>
              </Section>
            )}

            {phase === 'importing' && (
              <div className="px-3.5 py-4 font-mono text-mono10 text-accent">
                … escribiendo transacciones
              </div>
            )}

            {phase === 'done' && (
              <div className="px-3.5 py-4">
                <div className="font-mono text-mono11 text-accent">
                  ✓ {imported} tx importadas ({preview.length - imported} duplicadas omitidas)
                </div>
                <Btn
                  variant="outline"
                  block
                  onClick={() => {
                    setResult(null);
                    setPreview([]);
                    setPhase('idle');
                    setFilename('');
                    setImported(0);
                  }}
                  className="mt-2"
                >
                  NUEVA_IMPORTACIÓN
                </Btn>
              </div>
            )}
          </>
        )}

        {phase === 'error' && (
          <div className="px-3.5 py-4 font-mono text-mono10 text-danger">
            ✗ {error}
            <Btn
              variant="outline"
              block
              onClick={() => {
                setError(null);
                setPhase('idle');
              }}
              className="mt-2"
            >
              REINTENTAR
            </Btn>
          </div>
        )}
      </div>
    </>
  );
}

function BankBadge({ bank }: { bank: Bank }) {
  const tone = bank === 'other' ? 'muted' : 'ok';
  return <Badge tone={tone}>{bank.toUpperCase()}</Badge>;
}
