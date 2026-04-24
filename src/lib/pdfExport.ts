/**
 * PDF export moved out of the ExportPage bundle so jspdf + transitive
 * dependencies (html2canvas, dompurify) load on demand.
 */
import { jsPDF } from 'jspdf';
import { formatMoney } from '@/lib/format';
import type { Transaction } from '@/types';

export async function buildPdf(
  txs: readonly Transaction[],
  catById: Map<number, string>,
): Promise<Blob> {
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
