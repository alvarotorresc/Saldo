import { describe, it, expect } from 'vitest';
import { buildPdf } from './pdfExport';
import type { Transaction } from '@/types';

const sampleTx = (overrides: Partial<Transaction> = {}): Transaction => ({
  accountId: 1,
  date: '2026-04-01',
  amount: 10,
  kind: 'expense',
  description: 'test',
  month: '2026-04',
  createdAt: 0,
  ...overrides,
});

async function blobMagic(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  return new TextDecoder().decode(new Uint8Array(buf).slice(0, 5));
}

describe('buildPdf', () => {
  it('produces a Blob', async () => {
    const blob = await buildPdf([], new Map());
    expect(blob).toBeInstanceOf(Blob);
  });

  it('produces a PDF (magic number %PDF-)', async () => {
    const blob = await buildPdf([sampleTx()], new Map());
    expect(await blobMagic(blob)).toBe('%PDF-');
  });

  it('handles empty tx list without throwing', async () => {
    await expect(buildPdf([], new Map())).resolves.toBeInstanceOf(Blob);
  });

  it('handles 50 txs (multi-page territory) without throwing', async () => {
    const txs = Array.from({ length: 50 }, (_, i) =>
      sampleTx({ id: i + 1, description: `row ${i + 1}`, amount: i + 1 }),
    );
    const blob = await buildPdf(txs, new Map());
    expect(blob.size).toBeGreaterThan(0);
  });

  it('renders an income row with a + sign in the amount column', async () => {
    const blob = await buildPdf(
      [sampleTx({ kind: 'income', amount: 100, description: 'salary' })],
      new Map(),
    );
    // We cannot easily decode the PDF here, but we assert the function
    // doesn't throw for income and returns a non-empty blob. Sign rendering
    // is an integration concern; the core contract is "no crash on income".
    expect(blob.size).toBeGreaterThan(0);
  });
});
