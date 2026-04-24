import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { CategoryGroup } from '@/types';

const emptyChain = {
  where: () => emptyChain,
  equals: () => emptyChain,
  anyOf: () => emptyChain,
  between: () => emptyChain,
  filter: () => emptyChain,
  orderBy: () => emptyChain,
  toArray: () => [
    { id: 1, categoryId: 1, month: '2026-04', amount: 200 },
    { id: 2, categoryId: 2, month: '2026-04', amount: 50 },
  ],
  first: () => ({ id: 1, name: 'Cuenta principal', bank: 'manual' }),
};

vi.mock('@/db/database', () => ({
  db: {
    meta: { get: vi.fn(async () => undefined), put: vi.fn(async () => undefined) },
    categories: {
      toArray: () => [
        { id: 1, name: 'Supermercado', color: '#10B981', kind: 'expense', groupId: 1 },
        { id: 2, name: 'Restaurantes', color: '#F59E0B', kind: 'expense', groupId: 1 },
      ],
    },
    categoryGroups: {
      toArray: (): CategoryGroup[] => [
        { id: 1, name: 'Comida', color: '#F59E0B', icon: 'utensils', kind: 'expense', order: 1 },
        { id: 2, name: 'Transporte', color: '#60A5FA', icon: 'bus', kind: 'expense', order: 2 },
      ],
    },
    budgets: emptyChain,
    accounts: emptyChain,
    transactions: emptyChain,
  },
}));

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => {
    try {
      return (fn as () => unknown)();
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/db/queries', async () => {
  const actual = await vi.importActual<typeof import('@/db/queries')>('@/db/queries');
  return {
    ...actual,
    sumByKind: () => ({ income: 2000, expense: 300, net: 1700 }),
    dailySpend: () => new Array(30).fill(0).map((_, i) => (i % 5 === 0 ? 50 : 0)),
    dailySpendSeries: (_end: string, days: number) =>
      new Array(days).fill(0).map((_, i) => (i === days - 1 ? 42 : 3)),
    expensesByGroup: () =>
      new Map<number | 'none', number>([
        [1, 220],
        [2, 80],
      ]),
    expensesByCategory: () =>
      new Map<number | 'none', number>([
        [1, 220],
        [2, 80],
      ]),
    monthlyInOut: () =>
      Array.from({ length: 12 }, (_, i) => ({
        month: `2025-${String(i + 1).padStart(2, '0')}`,
        income: 2000 - i * 10,
        expense: 500 + i * 10,
      })),
  };
});

const { useApp } = await import('@/stores/app');
const { DashboardCharts } = await import('./DashboardCharts');

beforeEach(() => {
  useApp.setState({ month: '2026-04' });
});

describe('DashboardCharts', () => {
  it('renders the savings-rate ring, the 30D area chart, heatmap and donut legend', () => {
    render(<DashboardCharts />);
    expect(screen.getByTestId('dashboard-charts')).toBeInTheDocument();
    expect(screen.getAllByTestId('ring').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('area-chart')).toBeInTheDocument();
    expect(screen.getByTestId('heatmap-cal')).toBeInTheDocument();
    expect(screen.getByTestId('donut')).toBeInTheDocument();
    expect(screen.getByTestId('stacked-bars')).toBeInTheDocument();
  });

  it('changes the DAILY_SPEND window when a different range chip is selected', () => {
    render(<DashboardCharts />);
    // 30D is active by default.
    expect(screen.getByText(/DAILY_SPEND · 30D/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('range-7D'));
    expect(screen.getByText(/DAILY_SPEND · 7D/)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('range-YTD'));
    expect(screen.getByText(/DAILY_SPEND · YTD/)).toBeInTheDocument();
  });

  it('exposes one tab per canonical range key (7D/30D/90D/12M/YTD)', () => {
    render(<DashboardCharts />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['7D', '30D', '90D', '12M', 'YTD']);
  });
});
