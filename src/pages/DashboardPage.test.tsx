import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Transaction } from '@/types';

// Freeze tween to resolve immediately so hero NET renders deterministically.
vi.mock('@/lib/tween', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tween')>('@/lib/tween');
  return { ...actual, useTweenedNumber: (v: number) => v };
});

const mockTx: Transaction[] = [
  {
    id: 1,
    accountId: 1,
    date: '2026-04-10',
    amount: 20,
    kind: 'expense',
    description: 'Lidl',
    merchant: 'Lidl',
    categoryId: 1,
    month: '2026-04',
    createdAt: 0,
  },
  {
    id: 2,
    accountId: 1,
    date: '2026-04-12',
    amount: 2000,
    kind: 'income',
    description: 'Nómina',
    merchant: 'ACME',
    month: '2026-04',
    createdAt: 0,
  },
];

vi.mock('dexie-react-hooks', () => ({
  useLiveQuery: (fn: () => unknown) => {
    try {
      return (fn as () => unknown)();
    } catch {
      return undefined;
    }
  },
}));

vi.mock('@/db/database', () => ({
  db: {
    meta: { get: vi.fn(async () => undefined), put: vi.fn(async () => undefined) },
    categories: {
      toArray: () => [
        { id: 1, name: 'Supermercado', color: '#10B981', kind: 'expense', groupId: 1 },
      ],
    },
    categoryGroups: {
      toArray: () => [
        { id: 1, name: 'Comida', color: '#F59E0B', icon: 'utensils', kind: 'expense', order: 1 },
      ],
    },
  },
}));

vi.mock('@/db/queries', async () => {
  const actual = await vi.importActual<typeof import('@/db/queries')>('@/db/queries');
  return {
    ...actual,
    sumByKind: (month: string) =>
      month === '2026-04'
        ? { income: 2000, expense: 20, net: 1980 }
        : { income: 1000, expense: 200, net: 800 },
    txByMonth: () => mockTx,
    dailySpend: () => new Array(30).fill(0).map((_, i) => (i === 9 ? 20 : 0)),
    expensesByGroup: () => new Map<number | 'none', number>([[1, 20]]),
  };
});

const { useMeta } = await import('@/stores/meta');
const { DashboardPage } = await import('./DashboardPage');

beforeEach(() => {
  useMeta.setState({ dashboardMode: 'sobrio', hydrated: true });
});

function mount() {
  return render(
    <DashboardPage
      onGoImport={vi.fn()}
      onGoTransactions={vi.fn()}
      onGoSubscriptions={vi.fn()}
      onGoCharts={vi.fn()}
    />,
  );
}

describe('DashboardPage (Sobrio)', () => {
  it('renders the hero NET and the 30D sparkline with current month data', () => {
    mount();
    expect(screen.getByTestId('hero-net')).toHaveTextContent(/\+?[\d.,]+/);
    expect(screen.getByTestId('spark')).toBeInTheDocument();
    expect(screen.getByText(/SAVE_RATE/)).toBeInTheDocument();
    expect(screen.getByText(/Δ PREV/)).toBeInTheDocument();
  });

  it('toggles dashboardMode when CHARTS is pressed and persists via useMeta', () => {
    mount();
    const chartsBtn = screen.getAllByRole('button', { name: /CHARTS/ })[0];
    fireEvent.click(chartsBtn);
    expect(useMeta.getState().dashboardMode).toBe('charts');
    expect(screen.getByText(/PENDING_F4/)).toBeInTheDocument();
  });

  it('hydrates useMeta on mount when store is not yet hydrated', () => {
    useMeta.setState({ dashboardMode: 'sobrio', hydrated: false });
    const hydrateSpy = vi.spyOn(useMeta.getState(), 'hydrate');
    mount();
    expect(hydrateSpy).toHaveBeenCalled();
  });

  it('advances and retreats the active month via the chevron controls', async () => {
    const { useApp } = await import('@/stores/app');
    useApp.setState({ month: '2026-03' });
    mount();
    fireEvent.click(screen.getByLabelText('Mes anterior'));
    expect(useApp.getState().month).toBe('2026-02');
    fireEvent.click(screen.getByLabelText('Mes siguiente'));
    expect(useApp.getState().month).toBe('2026-03');
  });

  it('wires quick-action chips to their respective navigation handlers', () => {
    const onImport = vi.fn();
    const onTx = vi.fn();
    const onSubs = vi.fn();
    const onCharts = vi.fn();
    render(
      <DashboardPage
        onGoImport={onImport}
        onGoTransactions={onTx}
        onGoSubscriptions={onSubs}
        onGoCharts={onCharts}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /IMPORT/ }));
    fireEvent.click(screen.getByRole('button', { name: /NEW_TX/ }));
    fireEvent.click(screen.getByRole('button', { name: /SUBS/ }));
    fireEvent.click(screen.getAllByRole('button', { name: /CHARTS/ })[1]); // [0] is mode toggle
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onTx).toHaveBeenCalledTimes(1);
    expect(onSubs).toHaveBeenCalledTimes(1);
    expect(onCharts).toHaveBeenCalledTimes(1);
  });
});
