import { create } from 'zustand';
import { db } from '@/db/database';

export type DashboardMode = 'charts' | 'sobrio';

export const DASHBOARD_MODE_KEY = 'dashboardMode';
const DEFAULT_MODE: DashboardMode = 'sobrio';

function isDashboardMode(v: unknown): v is DashboardMode {
  return v === 'charts' || v === 'sobrio';
}

interface MetaState {
  dashboardMode: DashboardMode;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setDashboardMode: (m: DashboardMode) => Promise<void>;
}

export const useMeta = create<MetaState>((set) => ({
  dashboardMode: DEFAULT_MODE,
  hydrated: false,
  async hydrate() {
    const row = await db.meta.get(DASHBOARD_MODE_KEY);
    const mode = isDashboardMode(row?.value) ? row.value : DEFAULT_MODE;
    set({ dashboardMode: mode, hydrated: true });
  },
  async setDashboardMode(m) {
    set({ dashboardMode: m });
    await db.meta.put({ key: DASHBOARD_MODE_KEY, value: m });
  },
}));
