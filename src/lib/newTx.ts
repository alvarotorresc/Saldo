import type { TxKind, Transaction } from '@/types';

export interface NewTxDraft {
  kind: TxKind;
  amount: number;
  date: string; // yyyy-mm-dd
  description: string;
  merchant?: string;
  categoryId?: number;
  personalAmount?: number;
  accountId: number;
}

export interface NewTxError {
  field: 'amount' | 'date' | 'description' | 'personalAmount';
  message: string;
}

/**
 * Pure: parses the calculator-style amount input. Supports dot or comma as
 * decimal separator, spaces and thousands separators. Returns NaN on invalid
 * input; rounds to 2 decimals on success.
 */
export function parseAmountInput(raw: string): number {
  if (!raw) return NaN;
  const cleaned = raw.replace(/\s/g, '').replace(/ /g, '').replace(/[,]/g, '.');
  const idx = cleaned.lastIndexOf('.');
  const withoutSeps =
    idx === -1 ? cleaned : cleaned.slice(0, idx).replace(/[.]/g, '') + '.' + cleaned.slice(idx + 1);
  const n = Number(withoutSeps);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 100) / 100;
}

/** Pure: draft → array of validation errors. Empty array = valid. */
export function validateDraft(draft: NewTxDraft): NewTxError[] {
  const errors: NewTxError[] = [];
  if (!Number.isFinite(draft.amount) || draft.amount <= 0) {
    errors.push({ field: 'amount', message: 'Amount must be > 0' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) {
    errors.push({ field: 'date', message: 'Invalid date' });
  }
  if (!draft.description || draft.description.trim().length < 2) {
    errors.push({ field: 'description', message: 'Description too short' });
  }
  if (draft.personalAmount != null) {
    if (draft.personalAmount <= 0 || draft.personalAmount > draft.amount) {
      errors.push({
        field: 'personalAmount',
        message: 'Shared portion must be between 0 and total amount',
      });
    }
  }
  return errors;
}

/** Pure: converts a valid draft into the Transaction payload persisted to Dexie. */
export function draftToTransaction(draft: NewTxDraft): Omit<Transaction, 'id'> {
  const month = draft.date.slice(0, 7);
  return {
    accountId: draft.accountId,
    date: draft.date,
    amount: draft.amount,
    kind: draft.kind,
    description: draft.description.trim(),
    merchant: draft.merchant?.trim() || undefined,
    categoryId: draft.categoryId,
    personalAmount: draft.personalAmount,
    month,
    createdAt: Date.now(),
  };
}
