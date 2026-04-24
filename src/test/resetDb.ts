/**
 * Reset Dexie between tests when using fake-indexeddb. Closes the connection,
 * drops the database and re-opens so each test starts from an empty schema
 * without residue from previous specs.
 */
import { db } from '@/db/database';

export async function resetDb(): Promise<void> {
  try {
    db.close();
  } catch {
    // not open yet
  }
  await db.delete();
  await db.open();
}
