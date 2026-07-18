'use client';

import { create } from 'zustand';
import { api, type UserOperation, type ProtocolOverview } from './api-client';

// Polls the game API (operation every 15s, overview every 30s — same cadence
// as the original) and exposes shared state + refresh triggers.

interface OperationState {
  wallet: string | null;
  op: UserOperation | null;
  overview: ProtocolOverview | null;
  loading: boolean;
  error: string | null;
  selectedNodeId: string | null;
  setWallet: (w: string | null) => void;
  selectNode: (id: string | null) => void;
  refresh: () => Promise<void>;
  refreshOverview: () => Promise<void>;
}

let opTimer: ReturnType<typeof setInterval> | null = null;
let ovTimer: ReturnType<typeof setInterval> | null = null;

export const useOperation = create<OperationState>()((set, get) => ({
  wallet: null,
  op: null,
  overview: null,
  loading: false,
  error: null,
  selectedNodeId: null,

  setWallet: (wallet) => {
    if (get().wallet === wallet) return;
    set({ wallet, op: null, selectedNodeId: null });
    if (opTimer) clearInterval(opTimer);
    if (ovTimer) clearInterval(ovTimer);
    if (wallet) {
      const tick = () => get().refresh();
      const tickOv = () => get().refreshOverview();
      setTimeout(tick, 400);
      tickOv();
      opTimer = setInterval(tick, 15_000);
      ovTimer = setInterval(tickOv, 30_000);
    }
  },

  selectNode: (selectedNodeId) => set({ selectedNodeId }),

  refresh: async () => {
    const wallet = get().wallet;
    if (!wallet) return;
    set({ loading: true });
    try {
      const op = await api.operation(wallet);
      set({ op, error: null, loading: false });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'API unreachable', loading: false });
    }
  },

  refreshOverview: async () => {
    try {
      const overview = await api.overview();
      set({ overview });
    } catch {
      /* keep last */
    }
  },
}));
