import { create } from "zustand";
import type { ContextForkRequest } from "#/api/context-service/context-types";

interface ContextEngineeringState {
  isPanelOpen: boolean;
  forkRequest: ContextForkRequest | null;
  openPanel: () => void;
  closePanel: () => void;
  openFork: (request: ContextForkRequest) => void;
  closeFork: () => void;
}

export const useContextEngineeringStore = create<ContextEngineeringState>(
  (set) => ({
    isPanelOpen: false,
    forkRequest: null,
    openPanel: () => set({ isPanelOpen: true }),
    closePanel: () => set({ isPanelOpen: false }),
    openFork: (forkRequest) => set({ forkRequest }),
    closeFork: () => set({ forkRequest: null }),
  }),
);
