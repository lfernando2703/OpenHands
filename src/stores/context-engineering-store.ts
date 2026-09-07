import { create } from "zustand";
import type {
  ContextEditRequest,
  ContextForkRequest,
} from "#/api/context-service/context-types";

interface ContextEngineeringState {
  isPanelOpen: boolean;
  forkRequest: ContextForkRequest | null;
  editRequest: ContextEditRequest | null;
  isRewindOpen: boolean;
  isCheckpointOpen: boolean;
  rewindAnchor: string | null;
  openPanel: () => void;
  closePanel: () => void;
  openFork: (request: ContextForkRequest) => void;
  closeFork: () => void;
  openEdit: (request: ContextEditRequest) => void;
  closeEdit: () => void;
  openRewind: () => void;
  closeRewind: () => void;
  openCheckpoint: () => void;
  closeCheckpoint: () => void;
  setRewindAnchor: (afterTimestamp: string | null) => void;
}

export const useContextEngineeringStore = create<ContextEngineeringState>(
  (set) => ({
    isPanelOpen: false,
    forkRequest: null,
    editRequest: null,
    isRewindOpen: false,
    isCheckpointOpen: false,
    rewindAnchor: null,
    openPanel: () => set({ isPanelOpen: true }),
    closePanel: () => set({ isPanelOpen: false }),
    openFork: (forkRequest) => set({ forkRequest }),
    closeFork: () => set({ forkRequest: null }),
    openEdit: (editRequest) => set({ editRequest }),
    closeEdit: () => set({ editRequest: null }),
    openRewind: () => set({ isRewindOpen: true }),
    closeRewind: () => set({ isRewindOpen: false }),
    openCheckpoint: () => set({ isCheckpointOpen: true }),
    closeCheckpoint: () => set({ isCheckpointOpen: false }),
    setRewindAnchor: (rewindAnchor) => set({ rewindAnchor }),
  }),
);
