import { create } from 'zustand';
import { currentMonth } from '@/lib/format';

interface AppState {
  month: string;
  setMonth: (m: string) => void;
}

export const useApp = create<AppState>((set) => ({
  month: currentMonth(),
  setMonth: (m) => set({ month: m }),
}));
