export type Bank = 'n26' | 'bbva' | 'manual' | 'other';

export type TxKind = 'expense' | 'income' | 'transfer';

export interface Account {
  id?: number;
  name: string;
  bank: Bank;
  currency: string;
  createdAt: number;
  archived?: 0 | 1;
}

export interface CategoryGroup {
  id?: number;
  name: string;
  color: string;
  icon: string;
  kind: 'expense' | 'income';
  order: number;
  builtin?: 0 | 1;
}

export interface Category {
  id?: number;
  name: string;
  color: string;
  icon: string;
  kind: 'expense' | 'income';
  groupId?: number;
  builtin?: 0 | 1;
}

export interface Transaction {
  id?: number;
  accountId: number;
  date: string; // ISO yyyy-mm-dd
  amount: number; // total positive amount charged to account
  kind: TxKind;
  description: string;
  merchant?: string;
  categoryId?: number;
  notes?: string;
  tags?: string[];
  // month key yyyy-mm for fast filtering
  month: string;
  importHash?: string;
  source?: Bank;
  createdAt: number;
  // Tricount-style sharing
  personalAmount?: number; // my share when a cost is split; undefined = 100% mine
  splitPeople?: number; // informational
  splitNote?: string; // "Comida con Juan, Sara, Marta"
  reimbursementFor?: number; // if this tx is a received reimbursement linked to an expense id
}

export type SubscriptionCadence = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface Subscription {
  id?: number;
  name: string;
  amount: number;
  currency: string;
  cadence: SubscriptionCadence;
  nextCharge: string; // yyyy-mm-dd
  startDate: string; // yyyy-mm-dd
  categoryId?: number;
  color: string;
  notes?: string;
  active: 0 | 1;
  detectedSignature?: string; // link to recurring signature
  createdAt: number;
}

export interface Loan {
  id?: number;
  name: string;
  principal: number;
  interestRate: number; // annual %
  termMonths: number;
  startDate: string; // yyyy-mm-dd
  extraPayment?: number;
  color: string;
  notes?: string;
  createdAt: number;
}

export interface AccountBalance {
  id?: number;
  accountId: number;
  month: string; // yyyy-mm
  balance: number;
  createdAt: number;
}

export interface Budget {
  id?: number;
  // yyyy-mm, "*" for every month
  month: string;
  categoryId: number;
  amount: number;
  createdAt: number;
}

export interface Goal {
  id?: number;
  name: string;
  target: number;
  saved: number;
  deadline?: string; // yyyy-mm-dd
  color: string;
  createdAt: number;
}

export interface Recurring {
  id?: number;
  signature: string; // merchant or normalized description
  averageAmount: number;
  cadenceDays: number; // ~30 for monthly
  lastSeen: string; // yyyy-mm-dd
  sampleCount: number;
  kind: 'expense' | 'income';
  categoryId?: number;
}

export interface Rule {
  id?: number;
  pattern: string; // substring (case-insensitive)
  categoryId: number;
  priority: number;
}

export interface AppMeta {
  key: string;
  value: string;
}
