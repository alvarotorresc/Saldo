import type { Loan } from '@/types';

export interface AmortizationRow {
  month: number;
  date: string; // yyyy-mm-dd
  payment: number;
  principal: number;
  interest: number;
  balance: number;
  extra?: number;
}

export interface AmortizationSummary {
  monthlyPayment: number;
  totalInterest: number;
  totalPaid: number;
  months: number;
  endDate: string;
  rows: AmortizationRow[];
}

function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1 + months, d ?? 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function amortize(loan: Loan): AmortizationSummary {
  const principal = Number(loan.principal);
  const annualRate = Number(loan.interestRate) / 100;
  const monthlyRate = annualRate / 12;
  const n = Math.max(1, Math.floor(loan.termMonths));
  const extra = Math.max(0, Number(loan.extraPayment ?? 0));
  const basePayment =
    monthlyRate === 0
      ? principal / n
      : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -n));

  let balance = principal;
  let totalInterest = 0;
  let totalPaid = 0;
  const rows: AmortizationRow[] = [];
  let month = 0;
  while (balance > 0.005 && month < n + 600) {
    month++;
    const interest = balance * monthlyRate;
    let principalPart = Math.min(balance, basePayment - interest);
    let thisExtra = 0;
    if (extra > 0 && balance - principalPart > 0) {
      thisExtra = Math.min(extra, balance - principalPart);
      principalPart += thisExtra;
    }
    balance = Math.max(0, balance - principalPart);
    const payment = interest + principalPart;
    totalInterest += interest;
    totalPaid += payment;
    rows.push({
      month,
      date: addMonths(loan.startDate, month - 1),
      payment,
      principal: principalPart,
      interest,
      balance,
      extra: thisExtra || undefined,
    });
    if (balance <= 0.005) break;
  }
  return {
    monthlyPayment: basePayment,
    totalInterest,
    totalPaid,
    months: rows.length,
    endDate: rows[rows.length - 1]?.date ?? loan.startDate,
    rows,
  };
}

export function monthlyCostForCadence(amount: number, cadence: string): number {
  switch (cadence) {
    case 'weekly':
      return (amount * 52) / 12;
    case 'biweekly':
      return (amount * (365.25 / 14)) / 12;
    case 'monthly':
      return amount;
    case 'quarterly':
      return amount / 3;
    case 'yearly':
      return amount / 12;
    default:
      return amount;
  }
}

export function nextDateFromCadence(fromISO: string, cadence: string): string {
  const [y, m, d] = fromISO.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  switch (cadence) {
    case 'weekly':
      date.setDate(date.getDate() + 7);
      break;
    case 'biweekly':
      date.setDate(date.getDate() + 14);
      break;
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
  }
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function monthsElapsed(fromISO: string): number {
  const [y, m, d] = fromISO.split('-').map(Number);
  const now = new Date();
  const start = new Date(y, (m ?? 1) - 1, d ?? 1);
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
  if (now.getDate() < start.getDate()) months--;
  return Math.max(0, months);
}

export function daysUntil(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, (m ?? 1) - 1, d ?? 1).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target - today.getTime()) / 86400000);
}
