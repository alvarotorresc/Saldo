import { parseCSV } from '@/lib/csv';
import { parseAmount, parseDate, monthKey, hashStr, normalizeDesc } from './parse-helpers';
import type { Bank, Transaction } from '@/types';

export interface ParsedRow {
  date: string;
  amount: number; // signed
  description: string;
  merchant?: string;
}

export interface ImportResult {
  bank: Bank;
  rows: ParsedRow[];
  skipped: number;
  totalLines: number;
}

function pickIdx(headers: string[], candidates: string[]): number {
  const norm = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = norm.findIndex((h) => h.includes(c));
    if (idx >= 0) return idx;
  }
  return -1;
}

export function detectBank(headers: string[]): Bank {
  const joined = headers.join('|').toLowerCase();
  const hasN26Marker =
    (joined.includes('booking date') && joined.includes('partner')) ||
    joined.includes('payment reference') ||
    (joined.includes('beneficiario') && joined.includes('referencia')) ||
    joined.includes('value date');
  if (hasN26Marker) return 'n26';
  const hasBBVAMarker =
    joined.includes('f.valor') ||
    (joined.includes('concepto') && joined.includes('movimiento')) ||
    (joined.includes('concepto') && joined.includes('importe') && joined.includes('disponible')) ||
    joined.includes('f. valor');
  if (hasBBVAMarker) return 'bbva';
  return 'other';
}

function parseN26(rows: string[][]): ParsedRow[] {
  const [header, ...rest] = rows;
  const idxDate =
    pickIdx(header, ['booking date', 'fecha contable', 'fecha', 'date']) !== -1
      ? pickIdx(header, ['booking date', 'fecha contable', 'fecha', 'date'])
      : pickIdx(header, ['value date']);
  const idxPartner = pickIdx(header, ['partner name', 'beneficiario', 'payee']);
  const idxRef = pickIdx(header, ['payment reference', 'referencia', 'reference']);
  const idxAmount = pickIdx(header, ['amount (eur)', 'importe (eur)', 'importe', 'amount']);
  const out: ParsedRow[] = [];
  for (const r of rest) {
    const d = idxDate >= 0 ? parseDate(r[idxDate] ?? '') : null;
    const amt = idxAmount >= 0 ? parseAmount(r[idxAmount] ?? '') : NaN;
    if (!d || !Number.isFinite(amt)) continue;
    const partner = idxPartner >= 0 ? (r[idxPartner] ?? '').trim() : '';
    const ref = idxRef >= 0 ? (r[idxRef] ?? '').trim() : '';
    const description = [partner, ref].filter(Boolean).join(' — ') || 'N26';
    out.push({ date: d, amount: amt, description, merchant: partner || undefined });
  }
  return out;
}

function parseBBVA(rows: string[][]): ParsedRow[] {
  const [header, ...rest] = rows;
  const idxDate = pickIdx(header, ['fecha', 'f.valor', 'f. valor', 'date']);
  const idxConcept = pickIdx(header, ['concepto', 'movimiento', 'descripcion', 'description']);
  const idxObs = pickIdx(header, ['observaciones', 'obs.', 'detalle']);
  const idxAmount = pickIdx(header, ['importe', 'amount']);
  const out: ParsedRow[] = [];
  for (const r of rest) {
    const d = idxDate >= 0 ? parseDate(r[idxDate] ?? '') : null;
    const amt = idxAmount >= 0 ? parseAmount(r[idxAmount] ?? '') : NaN;
    if (!d || !Number.isFinite(amt)) continue;
    const concept = idxConcept >= 0 ? (r[idxConcept] ?? '').trim() : '';
    const obs = idxObs >= 0 ? (r[idxObs] ?? '').trim() : '';
    const description = [concept, obs].filter(Boolean).join(' — ') || 'BBVA';
    out.push({ date: d, amount: amt, description, merchant: concept || undefined });
  }
  return out;
}

function parseGeneric(rows: string[][]): ParsedRow[] {
  const [header, ...rest] = rows;
  const idxDate = pickIdx(header, ['fecha', 'date']);
  const idxDesc = pickIdx(header, ['concepto', 'descripcion', 'description', 'payee', 'partner']);
  const idxAmount = pickIdx(header, ['importe', 'amount']);
  const out: ParsedRow[] = [];
  for (const r of rest) {
    const d = idxDate >= 0 ? parseDate(r[idxDate] ?? '') : null;
    const amt = idxAmount >= 0 ? parseAmount(r[idxAmount] ?? '') : NaN;
    if (!d || !Number.isFinite(amt)) continue;
    const desc = idxDesc >= 0 ? (r[idxDesc] ?? '').trim() : '';
    out.push({
      date: d,
      amount: amt,
      description: desc || 'Movimiento',
      merchant: desc || undefined,
    });
  }
  return out;
}

export function parseStatement(text: string): ImportResult {
  let rows = parseCSV(text);
  // BBVA often prepends metadata lines; find real header row
  while (rows.length > 0) {
    const head = rows[0];
    const joined = head.join('|').toLowerCase();
    if (
      joined.includes('importe') ||
      joined.includes('amount') ||
      joined.includes('fecha') ||
      joined.includes('date')
    ) {
      break;
    }
    rows = rows.slice(1);
  }
  if (rows.length === 0) return { bank: 'other', rows: [], skipped: 0, totalLines: 0 };
  const bank = detectBank(rows[0]);
  const totalLines = rows.length - 1;
  let parsed: ParsedRow[] = [];
  if (bank === 'n26') parsed = parseN26(rows);
  else if (bank === 'bbva') parsed = parseBBVA(rows);
  else parsed = parseGeneric(rows);
  return { bank, rows: parsed, skipped: totalLines - parsed.length, totalLines };
}

export function toTransaction(
  accountId: number,
  source: Bank,
  row: ParsedRow,
): Omit<Transaction, 'id'> {
  const kind: Transaction['kind'] = row.amount < 0 ? 'expense' : 'income';
  const absAmount = Math.abs(row.amount);
  const merchant = (row.merchant ?? '').trim();
  const description = row.description;
  const sig = normalizeDesc([row.date, merchant || description, absAmount.toFixed(2)].join('|'));
  return {
    accountId,
    date: row.date,
    amount: absAmount,
    kind,
    description,
    merchant: merchant || undefined,
    month: monthKey(row.date),
    importHash: hashStr(sig),
    source,
    createdAt: Date.now(),
  };
}
