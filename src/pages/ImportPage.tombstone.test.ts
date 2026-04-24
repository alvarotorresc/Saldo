/**
 * Integration test for D-10: when a transaction is deleted via TxDetailPage
 * a tombstone is written with txFingerprint(tx). If the user re-imports the
 * same CSV line, ImportPage.doImport must read that tombstone and skip the
 * row instead of adding it again. We exercise the data flow directly without
 * mounting React — React state is irrelevant, the bug was in the Dexie layer.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/database';
import { resetDb } from '@/test/resetDb';
import { toTransaction } from '@/lib/importers';
import { txFingerprint } from '@/lib/txHash';
import type { ParsedRow } from '@/lib/importers';
import type { Transaction } from '@/types';

beforeEach(async () => {
  await resetDb();
});

afterEach(async () => {
  await resetDb();
});

const sampleRow: ParsedRow = {
  date: '2026-04-01',
  amount: -12.5,
  description: 'Supermercado Lidl Madrid',
  merchant: 'Lidl',
};

async function seedAccount(): Promise<number> {
  const id = await db.accounts.add({
    name: 'Cuenta principal',
    bank: 'manual',
    currency: 'EUR',
    createdAt: 0,
  });
  return id as number;
}

/**
 * Simulates ImportPage.doImport without React. Returns the counters the UI
 * surfaces.
 */
async function runImport(accountId: number, rows: ParsedRow[]) {
  const tombstones = await db.txTombstones.toArray();
  const tombstonedHashes = new Set(tombstones.map((t) => t.txHash));
  let added = 0;
  let tombstoneSkipped = 0;
  let duplicateSkipped = 0;
  for (const r of rows) {
    const payload = toTransaction(accountId, 'manual', r);
    const exists = payload.importHash
      ? await db.transactions
          .where('[accountId+importHash]')
          .equals([accountId, payload.importHash])
          .first()
      : undefined;
    if (exists) {
      duplicateSkipped++;
      continue;
    }
    const fp = await txFingerprint(payload);
    if (tombstonedHashes.has(fp)) {
      tombstoneSkipped++;
      continue;
    }
    await db.transactions.add(payload);
    added++;
  }
  return { added, tombstoneSkipped, duplicateSkipped };
}

describe('import honors tombstones (D-10 regression)', () => {
  it('does NOT re-import a transaction that was previously deleted', async () => {
    const accountId = await seedAccount();

    // 1. First import adds the tx.
    const first = await runImport(accountId, [sampleRow]);
    expect(first.added).toBe(1);
    expect(await db.transactions.count()).toBe(1);

    // 2. User deletes the tx → TxDetailPage writes a tombstone using the
    //    fingerprint.
    const tx = (await db.transactions.toArray())[0]!;
    const fp = await txFingerprint(tx);
    await db.transactions.delete(tx.id!);
    await db.txTombstones.put({ txHash: fp, deletedAt: Date.now() });

    // 3. Re-import the same CSV row — it must NOT resurrect.
    const second = await runImport(accountId, [sampleRow]);
    expect(second.added).toBe(0);
    expect(second.tombstoneSkipped).toBe(1);
    expect(await db.transactions.count()).toBe(0);
  });

  it('ignores tombstone when the row differs (different description)', async () => {
    const accountId = await seedAccount();

    // Seed a tombstone for the sample row.
    const payload = toTransaction(accountId, 'manual', sampleRow);
    const fp = await txFingerprint(payload);
    await db.txTombstones.put({ txHash: fp, deletedAt: Date.now() });

    // Import a different row — should be added.
    const other: ParsedRow = { ...sampleRow, description: 'Mercadona' };
    const res = await runImport(accountId, [other]);
    expect(res.added).toBe(1);
    expect(res.tombstoneSkipped).toBe(0);
  });

  it('tombstone still applies when the re-imported row would get a different category', async () => {
    // The fingerprint deliberately omits categoryId, so an imported payload
    // whose categorizer predicts a different category must still hit the
    // tombstone.
    const accountId = await seedAccount();
    const payload = toTransaction(accountId, 'manual', sampleRow);
    const fp = await txFingerprint({ ...payload, categoryId: 7 } as Transaction);
    await db.txTombstones.put({ txHash: fp, deletedAt: Date.now() });

    const res = await runImport(accountId, [sampleRow]);
    expect(res.added).toBe(0);
    expect(res.tombstoneSkipped).toBe(1);
  });
});
