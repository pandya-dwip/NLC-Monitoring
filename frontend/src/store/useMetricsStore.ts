import { create } from 'zustand';
import type { MetricsSnapshot } from '../types/metrics';

const MAX_HISTORY = 120;

interface MetricsStoreState {
  latest: MetricsSnapshot | null;
  history: MetricsSnapshot[];
  socketConnected: boolean;
  setSnapshot: (snapshot: MetricsSnapshot) => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useMetricsStore = create<MetricsStoreState>((set) => ({
  latest: null,
  history: [],
  socketConnected: false,
  setSnapshot: (snapshot) =>
    set((prev) => ({
      latest: snapshot,
      history: [...prev.history, snapshot].slice(-MAX_HISTORY),
    })),
  setSocketConnected: (connected) => set({ socketConnected: connected }),
}));
