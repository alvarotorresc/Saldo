import Dexie, { type Table, type UpdateSpec } from 'dexie';
import type {
  Account,
  AccountBalance,
  Category,
  CategoryGroup,
  Transaction,
  Budget,
  Goal,
  Loan,
  Recurring,
  Rule,
  Subscription,
  AppMeta,
} from '@/types';

class SaldoDB extends Dexie {
  accounts!: Table<Account, number>;
  categoryGroups!: Table<CategoryGroup, number>;
  categories!: Table<Category, number>;
  transactions!: Table<Transaction, number>;
  budgets!: Table<Budget, number>;
  goals!: Table<Goal, number>;
  recurring!: Table<Recurring, number>;
  rules!: Table<Rule, number>;
  subscriptions!: Table<Subscription, number>;
  loans!: Table<Loan, number>;
  balances!: Table<AccountBalance, number>;
  meta!: Table<AppMeta, string>;

  constructor() {
    super('saldo');
    this.version(1).stores({
      accounts: '++id, name, bank, archived',
      categories: '++id, name, kind, builtin',
      transactions:
        '++id, accountId, date, month, kind, categoryId, importHash, [accountId+importHash]',
      budgets: '++id, month, categoryId, [month+categoryId]',
      goals: '++id, name, deadline',
      recurring: '++id, signature, kind',
      rules: '++id, priority',
      meta: '&key',
    });
    this.version(2)
      .stores({
        accounts: '++id, name, bank, archived',
        categoryGroups: '++id, name, kind, order',
        categories: '++id, name, kind, groupId, builtin',
        transactions:
          '++id, accountId, date, month, kind, categoryId, importHash, [accountId+importHash]',
        budgets: '++id, month, categoryId, [month+categoryId]',
        goals: '++id, name, deadline',
        recurring: '++id, signature, kind',
        rules: '++id, priority',
        subscriptions: '++id, name, cadence, nextCharge, active',
        loans: '++id, name, startDate',
        balances: '++id, accountId, month, [accountId+month]',
        meta: '&key',
      })
      .upgrade(async (trans) => {
        // Seed groups and re-link categories on migration
        const groupsTable = trans.table<CategoryGroup, number>('categoryGroups');
        const catsTable = trans.table<Category, number>('categories');
        const existingGroups = await groupsTable.count();
        if (existingGroups === 0) {
          const ids = await groupsTable.bulkAdd(DEFAULT_GROUPS, { allKeys: true });
          const byName = new Map<string, number>();
          DEFAULT_GROUPS.forEach((g, i) => byName.set(g.name, ids[i] as number));
          const all = await catsTable.toArray();
          for (const c of all) {
            const gName = CATEGORY_TO_GROUP[c.name] ?? (c.kind === 'income' ? 'Ingresos' : 'Otros');
            const gid = byName.get(gName);
            if (c.id && gid) await catsTable.update(c.id, { groupId: gid });
          }
        }
      });
    this.version(3).stores({
      accounts: '++id, name, bank, archived',
      categoryGroups: '++id, name, kind, order',
      categories: '++id, name, kind, groupId, builtin',
      transactions:
        '++id, accountId, date, month, kind, categoryId, importHash, reimbursementFor, [accountId+importHash]',
      budgets: '++id, month, categoryId, [month+categoryId]',
      goals: '++id, name, deadline',
      recurring: '++id, signature, kind',
      rules: '++id, priority, categoryId',
      subscriptions: '++id, name, cadence, nextCharge, active',
      loans: '++id, name, startDate',
      balances: '++id, accountId, month, [accountId+month]',
      meta: '&key',
    });
    this.version(4).stores({
      accounts: '++id, name, bank, archived',
      categoryGroups: '++id, name, kind, order',
      categories: '++id, name, kind, groupId, builtin',
      transactions:
        '++id, accountId, date, month, kind, categoryId, importHash, reimbursementFor, [accountId+importHash]',
      budgets: '++id, month, categoryId, [month+categoryId]',
      goals: '++id, name, deadline',
      recurring: '++id, signature, kind',
      rules: '++id, priority, categoryId',
      subscriptions: '++id, name, cadence, nextCharge, active',
      loans: '++id, name, startDate',
      balances: '++id, accountId, month, [accountId+month]',
      meta: '&key',
    });
    // v5 — rules gain `enabled`, `hits`, `lastHitAt` for the F6 Rules UI.
    this.version(5)
      .stores({
        accounts: '++id, name, bank, archived',
        categoryGroups: '++id, name, kind, order',
        categories: '++id, name, kind, groupId, builtin',
        transactions:
          '++id, accountId, date, month, kind, categoryId, importHash, reimbursementFor, [accountId+importHash]',
        budgets: '++id, month, categoryId, [month+categoryId]',
        goals: '++id, name, deadline',
        recurring: '++id, signature, kind',
        rules: '++id, priority, categoryId, enabled',
        subscriptions: '++id, name, cadence, nextCharge, active',
        loans: '++id, name, startDate',
        balances: '++id, accountId, month, [accountId+month]',
        meta: '&key',
      })
      .upgrade(async (trans) => {
        const table = trans.table<Rule, number>('rules');
        const all = await table.toArray();
        for (const r of all) {
          if (r.id != null && r.enabled === undefined) {
            await table.update(r.id, { enabled: 1, hits: r.hits ?? 0 });
          }
        }
      });
  }
}

export const db = new SaldoDB();

const DEFAULT_GROUPS: Omit<CategoryGroup, 'id'>[] = [
  { name: 'Comida', color: '#F59E0B', icon: 'utensils', kind: 'expense', order: 1, builtin: 1 },
  { name: 'Vivienda', color: '#A78BFA', icon: 'home', kind: 'expense', order: 2, builtin: 1 },
  { name: 'Transporte', color: '#60A5FA', icon: 'bus', kind: 'expense', order: 3, builtin: 1 },
  { name: 'Servicios', color: '#F472B6', icon: 'zap', kind: 'expense', order: 4, builtin: 1 },
  {
    name: 'Suscripciones',
    color: '#818CF8',
    icon: 'repeat',
    kind: 'expense',
    order: 5,
    builtin: 1,
  },
  { name: 'Salud', color: '#34D399', icon: 'heart', kind: 'expense', order: 6, builtin: 1 },
  { name: 'Ocio', color: '#FB7185', icon: 'star', kind: 'expense', order: 7, builtin: 1 },
  { name: 'Compras', color: '#FBBF24', icon: 'bag', kind: 'expense', order: 8, builtin: 1 },
  { name: 'Otros', color: '#8A8A93', icon: 'dots', kind: 'expense', order: 9, builtin: 1 },
  { name: 'Ingresos', color: '#10B981', icon: 'briefcase', kind: 'income', order: 10, builtin: 1 },
];

const CATEGORY_TO_GROUP: Record<string, string> = {
  Supermercado: 'Comida',
  Restaurantes: 'Comida',
  Transporte: 'Transporte',
  Vivienda: 'Vivienda',
  Servicios: 'Servicios',
  Salud: 'Salud',
  Ocio: 'Ocio',
  Compras: 'Compras',
  Suscripciones: 'Suscripciones',
  'Otros gastos': 'Otros',
  Nómina: 'Ingresos',
  Transferencia: 'Ingresos',
  'Otros ingresos': 'Ingresos',
};

const DEFAULT_CATEGORIES: Omit<Category, 'id' | 'groupId'>[] = [
  { name: 'Supermercado', color: '#10B981', icon: 'cart', kind: 'expense', builtin: 1 },
  { name: 'Restaurantes', color: '#F59E0B', icon: 'utensils', kind: 'expense', builtin: 1 },
  { name: 'Transporte', color: '#60A5FA', icon: 'bus', kind: 'expense', builtin: 1 },
  { name: 'Vivienda', color: '#A78BFA', icon: 'home', kind: 'expense', builtin: 1 },
  { name: 'Servicios', color: '#F472B6', icon: 'zap', kind: 'expense', builtin: 1 },
  { name: 'Salud', color: '#34D399', icon: 'heart', kind: 'expense', builtin: 1 },
  { name: 'Ocio', color: '#FB7185', icon: 'star', kind: 'expense', builtin: 1 },
  { name: 'Compras', color: '#FBBF24', icon: 'bag', kind: 'expense', builtin: 1 },
  { name: 'Suscripciones', color: '#818CF8', icon: 'repeat', kind: 'expense', builtin: 1 },
  { name: 'Otros gastos', color: '#8A8A93', icon: 'dots', kind: 'expense', builtin: 1 },
  { name: 'Nómina', color: '#10B981', icon: 'briefcase', kind: 'income', builtin: 1 },
  { name: 'Transferencia', color: '#60A5FA', icon: 'arrow', kind: 'income', builtin: 1 },
  { name: 'Otros ingresos', color: '#8A8A93', icon: 'dots', kind: 'income', builtin: 1 },
];

const DEFAULT_RULES: Omit<Rule, 'id'>[] = [
  { pattern: 'mercadona', categoryId: 0, priority: 10 },
  { pattern: 'lidl', categoryId: 0, priority: 10 },
  { pattern: 'carrefour', categoryId: 0, priority: 10 },
  { pattern: 'dia ', categoryId: 0, priority: 10 },
  { pattern: 'alcampo', categoryId: 0, priority: 10 },
  { pattern: 'consum', categoryId: 0, priority: 10 },
  { pattern: 'aldi', categoryId: 0, priority: 10 },
  { pattern: 'uber eats', categoryId: 1, priority: 10 },
  { pattern: 'glovo', categoryId: 1, priority: 10 },
  { pattern: 'just eat', categoryId: 1, priority: 10 },
  { pattern: 'burger', categoryId: 1, priority: 5 },
  { pattern: 'mcdonald', categoryId: 1, priority: 5 },
  { pattern: 'restaurante', categoryId: 1, priority: 5 },
  { pattern: 'uber ', categoryId: 2, priority: 10 },
  { pattern: 'cabify', categoryId: 2, priority: 10 },
  { pattern: 'renfe', categoryId: 2, priority: 10 },
  { pattern: 'emt', categoryId: 2, priority: 10 },
  { pattern: 'metro', categoryId: 2, priority: 5 },
  { pattern: 'iberdrola', categoryId: 4, priority: 10 },
  { pattern: 'endesa', categoryId: 4, priority: 10 },
  { pattern: 'naturgy', categoryId: 4, priority: 10 },
  { pattern: 'vodafone', categoryId: 4, priority: 10 },
  { pattern: 'movistar', categoryId: 4, priority: 10 },
  { pattern: 'orange', categoryId: 4, priority: 10 },
  { pattern: 'alquiler', categoryId: 3, priority: 10 },
  { pattern: 'hipoteca', categoryId: 3, priority: 10 },
  { pattern: 'netflix', categoryId: 8, priority: 10 },
  { pattern: 'spotify', categoryId: 8, priority: 10 },
  { pattern: 'hbo', categoryId: 8, priority: 10 },
  { pattern: 'disney', categoryId: 8, priority: 10 },
  { pattern: 'prime video', categoryId: 8, priority: 10 },
  { pattern: 'youtube', categoryId: 8, priority: 10 },
  { pattern: 'icloud', categoryId: 8, priority: 10 },
  { pattern: 'farmacia', categoryId: 5, priority: 10 },
  { pattern: 'amazon', categoryId: 7, priority: 5 },
  { pattern: 'zara', categoryId: 7, priority: 8 },
  { pattern: 'decathlon', categoryId: 7, priority: 8 },
  { pattern: 'cine', categoryId: 6, priority: 5 },
  { pattern: 'nomina', categoryId: 10, priority: 10 },
  { pattern: 'nómina', categoryId: 10, priority: 10 },
  { pattern: 'salary', categoryId: 10, priority: 10 },
  { pattern: 'transferencia', categoryId: 11, priority: 3 },
];

// Module-level singleton: ensures the seed runs exactly once per page load,
// even if React 18 StrictMode double-invokes the caller's effect.
let seedPromise: Promise<void> | null = null;

export function seedIfEmpty(): Promise<void> {
  if (!seedPromise) {
    seedPromise = doSeed().catch((err) => {
      // Reset so a later call can retry after a genuine failure.
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function doSeed(): Promise<void> {
  // One atomic transaction covering seed (groups + categories + rules + account)
  // and cleanup of duplicates from the buggy pre-singleton version.
  await db.transaction(
    'rw',
    [
      db.categoryGroups,
      db.categories,
      db.rules,
      db.accounts,
      db.transactions,
      db.subscriptions,
      db.budgets,
      db.recurring,
      db.meta,
    ],
    async () => {
      const needGroups = (await db.categoryGroups.count()) === 0;
      if (needGroups) {
        await db.categoryGroups.bulkAdd(DEFAULT_GROUPS, { allKeys: true });
      }
      const groupByName = new Map<string, number>();
      const existingGroups = await db.categoryGroups.toArray();
      existingGroups.forEach((g) => g.id && groupByName.set(g.name, g.id));

      const needCats = (await db.categories.count()) === 0;
      if (needCats) {
        const catsWithGroup = DEFAULT_CATEGORIES.map((c) => ({
          ...c,
          groupId: groupByName.get(CATEGORY_TO_GROUP[c.name] ?? 'Otros'),
        }));
        const ids = (await db.categories.bulkAdd(catsWithGroup, { allKeys: true })) as number[];
        const rules = DEFAULT_RULES.map((r) => ({ ...r, categoryId: ids[r.categoryId] }));
        await db.rules.bulkAdd(rules);
      } else {
        // ensure existing cats are linked to groups
        const cats = await db.categories.toArray();
        for (const c of cats) {
          if (!c.groupId && c.id) {
            const gid = groupByName.get(
              CATEGORY_TO_GROUP[c.name] ?? (c.kind === 'income' ? 'Ingresos' : 'Otros'),
            );
            if (gid) await db.categories.update(c.id, { groupId: gid });
          }
        }
      }

      const needAccount = (await db.accounts.count()) === 0;
      if (needAccount) {
        await db.accounts.add({
          name: 'Cuenta principal',
          bank: 'manual',
          currency: 'EUR',
          createdAt: Date.now(),
        });
      }

      // Always attempt cleanup (gated by meta flag) so users with a DB
      // already duplicated by the buggy version get healed on next boot.
      await cleanupDuplicatesMigration();
    },
  );
}

const DUPES_MIGRATED_KEY = 'duplicatesMigratedV1';

/**
 * Deduplicates categoryGroups, categories, and rules left over by the
 * pre-singleton seed. Safe no-op after the first successful run (gated
 * via `db.meta.duplicatesMigratedV1`).
 *
 * MUST run inside a `db.transaction('rw', ...)` that covers:
 *   categoryGroups, categories, rules, transactions,
 *   subscriptions, budgets, recurring, meta.
 */
async function cleanupDuplicatesMigration(): Promise<void> {
  const flag = await db.meta.get(DUPES_MIGRATED_KEY);
  if (flag) return;

  // --- 1. Dedup categoryGroups by (name + kind); canonical = lowest id.
  const allGroups = await db.categoryGroups.toArray();
  const groupCanonical = new Map<string, number>(); // key -> canonical id
  const groupIdRemap = new Map<number, number>(); // oldId -> canonicalId
  for (const g of allGroups) {
    if (g.id == null) continue;
    const k = `${g.name}\u0000${g.kind}`;
    const current = groupCanonical.get(k);
    if (current == null || g.id < current) groupCanonical.set(k, g.id);
  }
  for (const g of allGroups) {
    if (g.id == null) continue;
    const k = `${g.name}\u0000${g.kind}`;
    const canon = groupCanonical.get(k)!;
    groupIdRemap.set(g.id, canon);
  }

  // Remap categories.groupId to canonical BEFORE dedup/delete.
  const allCats = await db.categories.toArray();
  for (const c of allCats) {
    if (c.id == null || c.groupId == null) continue;
    const canon = groupIdRemap.get(c.groupId);
    if (canon != null && canon !== c.groupId) {
      await db.categories.update(c.id, { groupId: canon });
      c.groupId = canon;
    }
  }

  // --- 2. Dedup categories by (name + groupId + kind); canonical = lowest id.
  const catCanonical = new Map<string, number>();
  const catIdRemap = new Map<number, number>();
  for (const c of allCats) {
    if (c.id == null) continue;
    const k = `${c.name}\u0000${c.groupId ?? ''}\u0000${c.kind}`;
    const current = catCanonical.get(k);
    if (current == null || c.id < current) catCanonical.set(k, c.id);
  }
  for (const c of allCats) {
    if (c.id == null) continue;
    const k = `${c.name}\u0000${c.groupId ?? ''}\u0000${c.kind}`;
    catIdRemap.set(c.id, catCanonical.get(k)!);
  }

  // --- 3. Remap categoryId in every referencing table.
  const remapCat = async <T extends { id?: number; categoryId?: number }>(
    table: Table<T, number>,
  ): Promise<void> => {
    const rows = await table.toArray();
    for (const row of rows) {
      if (row.id == null || row.categoryId == null) continue;
      const canon = catIdRemap.get(row.categoryId);
      if (canon != null && canon !== row.categoryId) {
        const changes: UpdateSpec<{ categoryId: number }> = { categoryId: canon };
        await table.update(row.id, changes as UpdateSpec<T>);
      }
    }
  };
  await remapCat(db.transactions);
  await remapCat(db.rules);
  await remapCat(db.subscriptions);
  await remapCat(db.budgets);
  await remapCat(db.recurring);

  // --- 4. Delete non-canonical categories.
  const catIdsToDelete: number[] = [];
  for (const [oldId, canon] of catIdRemap) {
    if (oldId !== canon) catIdsToDelete.push(oldId);
  }
  if (catIdsToDelete.length) await db.categories.bulkDelete(catIdsToDelete);

  // --- 5. Dedup rules by (pattern + categoryId) AFTER remap; canonical = lowest id.
  const allRules = await db.rules.toArray();
  const ruleCanonical = new Map<string, number>();
  const ruleIdsToDelete: number[] = [];
  for (const r of allRules) {
    if (r.id == null) continue;
    const k = `${r.pattern}\u0000${r.categoryId}`;
    const current = ruleCanonical.get(k);
    if (current == null) ruleCanonical.set(k, r.id);
    else if (r.id < current) {
      ruleIdsToDelete.push(current);
      ruleCanonical.set(k, r.id);
    } else {
      ruleIdsToDelete.push(r.id);
    }
  }
  if (ruleIdsToDelete.length) await db.rules.bulkDelete(ruleIdsToDelete);

  // --- 6. Delete non-canonical categoryGroups.
  const groupIdsToDelete: number[] = [];
  for (const [oldId, canon] of groupIdRemap) {
    if (oldId !== canon) groupIdsToDelete.push(oldId);
  }
  if (groupIdsToDelete.length) await db.categoryGroups.bulkDelete(groupIdsToDelete);

  // --- 7. Mark migrated so we never run again on this device.
  await db.meta.put({ key: DUPES_MIGRATED_KEY, value: String(Date.now()) });
}
