import type { Transaction, Category } from '@/types';

/** Escapes a field for RFC-4180 CSV output: quotes only when needed. */
export function escapeCsvField(v: string): string {
  if (!v) return '';
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export interface CsvRowContext {
  categoryName?: string;
  accountName?: string;
}

/**
 * Pure: serializes transactions as RFC-4180 CSV. First row is the header.
 * Amount is signed (positive income, negative expense, transfer as-is).
 */
export function transactionsToCsv(
  txs: readonly Transaction[],
  categoriesById: Map<number, Pick<Category, 'name'>>,
): string {
  const header = ['date', 'kind', 'amount', 'description', 'merchant', 'category', 'notes'];
  const lines = [header.join(',')];
  for (const t of txs) {
    const cat = t.categoryId ? (categoriesById.get(t.categoryId)?.name ?? '') : '';
    const amt = t.kind === 'expense' ? -Math.abs(t.amount) : t.amount;
    const row = [
      t.date,
      t.kind,
      amt.toFixed(2),
      escapeCsvField(t.description ?? ''),
      escapeCsvField(t.merchant ?? ''),
      escapeCsvField(cat),
      escapeCsvField(t.notes ?? ''),
    ];
    lines.push(row.join(','));
  }
  return lines.join('\r\n');
}

/**
 * Pure: produces an OFX 2.1.1 statement. We emit SGML (OFX 1.x) syntax since
 * it is the most widely supported variant for personal-finance importers
 * (YNAB, GnuCash, etc.). Only the expense/income txs are included; transfers
 * are skipped (OFX has no single-account transfer concept without a
 * destination account).
 */
export function transactionsToOfx(
  txs: readonly Transaction[],
  opts: { bankId?: string; acctId?: string; curdef?: string } = {},
): string {
  const bankId = opts.bankId ?? 'SALDO';
  const acctId = opts.acctId ?? 'LOCAL';
  const curdef = opts.curdef ?? 'EUR';
  const dtNow = formatOfxDate(new Date());
  const usable = txs.filter((t) => t.kind !== 'transfer');
  const dates = usable.map((t) => t.date).sort();
  const dtStart = formatOfxDate(dates[0] ? new Date(dates[0]) : new Date());
  const dtEnd = formatOfxDate(
    dates[dates.length - 1] ? new Date(dates[dates.length - 1]) : new Date(),
  );

  const header =
    'OFXHEADER:100\r\nDATA:OFXSGML\r\nVERSION:102\r\nSECURITY:NONE\r\nENCODING:USASCII\r\nCHARSET:1252\r\nCOMPRESSION:NONE\r\nOLDFILEUID:NONE\r\nNEWFILEUID:NONE\r\n\r\n';

  const body = [
    '<OFX>',
    '<SIGNONMSGSRSV1><SONRS>',
    '<STATUS><CODE>0<SEVERITY>INFO</STATUS>',
    `<DTSERVER>${dtNow}`,
    '<LANGUAGE>SPA',
    '</SONRS></SIGNONMSGSRSV1>',
    '<BANKMSGSRSV1><STMTTRNRS>',
    '<TRNUID>1',
    '<STATUS><CODE>0<SEVERITY>INFO</STATUS>',
    '<STMTRS>',
    `<CURDEF>${curdef}`,
    '<BANKACCTFROM>',
    `<BANKID>${bankId}`,
    `<ACCTID>${acctId}`,
    '<ACCTTYPE>CHECKING',
    '</BANKACCTFROM>',
    '<BANKTRANLIST>',
    `<DTSTART>${dtStart}`,
    `<DTEND>${dtEnd}`,
    ...usable.map((t) => {
      const amt = t.kind === 'expense' ? -Math.abs(t.amount) : t.amount;
      const type = t.kind === 'income' ? 'CREDIT' : 'DEBIT';
      return [
        '<STMTTRN>',
        `<TRNTYPE>${type}`,
        `<DTPOSTED>${formatOfxDate(new Date(t.date))}`,
        `<TRNAMT>${amt.toFixed(2)}`,
        `<FITID>${String(t.id ?? '0').padStart(6, '0')}-${t.date.replace(/-/g, '')}`,
        `<NAME>${ofxEscape((t.merchant ?? t.description).slice(0, 32))}`,
        `<MEMO>${ofxEscape((t.description ?? '').slice(0, 64))}`,
        '</STMTTRN>',
      ].join('\r\n');
    }),
    '</BANKTRANLIST>',
    '<LEDGERBAL>',
    `<BALAMT>${sumSigned(usable).toFixed(2)}`,
    `<DTASOF>${dtEnd}`,
    '</LEDGERBAL>',
    '</STMTRS>',
    '</STMTTRNRS></BANKMSGSRSV1>',
    '</OFX>',
  ].join('\r\n');

  return header + body + '\r\n';
}

function ofxEscape(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatOfxDate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${day}${hh}${mm}${ss}`;
}

function sumSigned(txs: readonly Transaction[]): number {
  let s = 0;
  for (const t of txs) {
    if (t.kind === 'income') s += t.amount;
    else if (t.kind === 'expense') s -= t.amount;
  }
  return s;
}
