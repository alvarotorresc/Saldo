import type { Transaction } from '@/types';

/**
 * Deterministic SHA-256 hash of a transaction used as TX_ID-style fingerprint
 * in the detail view. Only stable, user-visible fields enter the hash so that
 * ledger re-imports that preserve semantics also preserve the hash.
 */
const STABLE_FIELDS: (keyof Transaction)[] = [
  'accountId',
  'date',
  'amount',
  'kind',
  'description',
  'merchant',
  'categoryId',
  'personalAmount',
  'reimbursementFor',
];

export function canonicalTxJson(tx: Transaction): string {
  const picked: Record<string, unknown> = {};
  for (const k of STABLE_FIELDS) {
    const v = tx[k];
    if (v !== undefined) picked[k as string] = v;
  }
  const keys = Object.keys(picked).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = picked[k];
  return JSON.stringify(sorted);
}

function toHex(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

export async function txHash(tx: Transaction): Promise<string> {
  const data = new TextEncoder().encode(canonicalTxJson(tx));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}

/**
 * Fingerprint SIN categoría ni personalAmount, usado para tombstones y
 * deduplicación import-vs-deleted. Ambos campos pueden variar entre una
 * eliminación y una re-importación del mismo CSV: el usuario puede haber
 * re-categorizado la tx antes de borrarla, o el categorizer heurístico puede
 * predecir otra categoría la segunda vez. El fingerprint ignora esos campos
 * para que el match contra tombstones dependa sólo del origen estable.
 */
const FINGERPRINT_FIELDS: (keyof Transaction)[] = [
  'accountId',
  'date',
  'amount',
  'kind',
  'description',
  'merchant',
  'reimbursementFor',
];

export async function txFingerprint(tx: Transaction): Promise<string> {
  const picked: Record<string, unknown> = {};
  for (const k of FINGERPRINT_FIELDS) {
    const v = tx[k];
    if (v !== undefined) picked[k as string] = v;
  }
  const keys = Object.keys(picked).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = picked[k];
  const data = new TextEncoder().encode(JSON.stringify(sorted));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
}
