export interface ImportCandidate {
  date?: string; // yyyy-mm-dd
  amount?: number;
  description?: string;
  merchant?: string;
  kind?: 'expense' | 'income' | 'transfer';
}

/**
 * Pure: scores how confident we are that a parsed CSV row maps cleanly to a
 * Transaction. Returns a number in [0, 1]. 1.0 means every field is present
 * and plausible. Rows < 0.8 are flagged warning in the Import preview.
 */
export function importConfidence(row: ImportCandidate): number {
  let score = 1;
  if (!row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) score -= 0.4;
  if (row.amount == null || !Number.isFinite(row.amount) || row.amount <= 0) score -= 0.3;
  if (!row.description || row.description.trim().length < 2) score -= 0.15;
  if (!row.merchant || row.merchant.trim().length < 2) score -= 0.1;
  if (!row.kind) score -= 0.05;
  return Math.max(0, Math.min(1, score));
}

export function isWarningRow(row: ImportCandidate): boolean {
  return importConfidence(row) < 0.8;
}
