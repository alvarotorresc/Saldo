import type {
  Account,
  AccountBalance,
  Budget,
  Category,
  CategoryGroup,
  Goal,
  Loan,
  Rule,
  Subscription,
  Transaction,
} from '@/types';

export interface SaldoSnapshot {
  version: 1;
  exportedAt: string; // ISO
  accounts: Account[];
  categoryGroups: CategoryGroup[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  rules: Rule[];
  subscriptions: Subscription[];
  loans: Loan[];
  balances: AccountBalance[];
}

/** Pure: produces the canonical JSON string for a .saldo/.json export. */
export function serializeSnapshot(snapshot: SaldoSnapshot): string {
  return JSON.stringify(snapshot);
}

/**
 * Pure: parses an exported payload back into a snapshot. Throws a descriptive
 * error if the version is unknown or the shape cannot be recovered.
 */
export function parseSnapshot(raw: string): SaldoSnapshot {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Invalid .saldo payload: not valid JSON');
  }
  if (!data || typeof data !== 'object') throw new Error('Invalid .saldo payload: not an object');
  const d = data as Partial<SaldoSnapshot>;
  if (d.version !== 1) throw new Error(`Unsupported .saldo version: ${String(d.version)}`);
  for (const key of [
    'accounts',
    'categoryGroups',
    'categories',
    'transactions',
    'budgets',
    'goals',
    'rules',
    'subscriptions',
    'loans',
    'balances',
  ] as const) {
    if (!Array.isArray(d[key])) {
      throw new Error(`Invalid .saldo payload: "${key}" must be an array`);
    }
  }
  return {
    version: 1,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    accounts: d.accounts!,
    categoryGroups: d.categoryGroups!,
    categories: d.categories!,
    transactions: d.transactions!,
    budgets: d.budgets!,
    goals: d.goals!,
    rules: d.rules!,
    subscriptions: d.subscriptions!,
    loans: d.loans!,
    balances: d.balances!,
  };
}
