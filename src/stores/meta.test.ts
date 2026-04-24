import { describe, it, expect, vi, beforeEach } from 'vitest';

const store = new Map<string, { key: string; value: string }>();

vi.mock('@/db/database', () => ({
  db: {
    meta: {
      get: vi.fn(async (key: string) => store.get(key)),
      put: vi.fn(async (row: { key: string; value: string }) => {
        store.set(row.key, row);
      }),
    },
  },
}));

// Import AFTER the mock so the store binds to the stub.
const { useMeta, DASHBOARD_MODE_KEY } = await import('./meta');

beforeEach(() => {
  store.clear();
  useMeta.setState({ dashboardMode: 'sobrio', hydrated: false });
});

describe('useMeta', () => {
  it('persists dashboardMode to db.meta on setDashboardMode and reflects it in state', async () => {
    await useMeta.getState().setDashboardMode('charts');

    expect(useMeta.getState().dashboardMode).toBe('charts');
    expect(store.get(DASHBOARD_MODE_KEY)).toEqual({
      key: DASHBOARD_MODE_KEY,
      value: 'charts',
    });
  });

  it('hydrate() rehydrates dashboardMode from db.meta, falling back to sobrio when absent or corrupt', async () => {
    store.set(DASHBOARD_MODE_KEY, { key: DASHBOARD_MODE_KEY, value: 'charts' });
    await useMeta.getState().hydrate();
    expect(useMeta.getState().dashboardMode).toBe('charts');
    expect(useMeta.getState().hydrated).toBe(true);

    useMeta.setState({ dashboardMode: 'charts', hydrated: false });
    store.set(DASHBOARD_MODE_KEY, { key: DASHBOARD_MODE_KEY, value: 'garbage' });
    await useMeta.getState().hydrate();
    expect(useMeta.getState().dashboardMode).toBe('sobrio');
  });
});
