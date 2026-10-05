import { create } from 'zustand';

/**
 * UI-only state.
 *
 * Nothing here is persisted and nothing here is authoritative: activities live in
 * SQLite, preferences in the settings store. This store exists for the things
 * that genuinely are ephemeral and need to be reachable from anywhere — the
 * add/edit sheet, and the undo snackbar that follows a destructive action.
 */

export type SheetMode =
  | { kind: 'closed' }
  | { kind: 'create'; startedAt?: Date; categoryId?: string }
  | { kind: 'edit'; id: string };

export type Snackbar = {
  message: string;
  tone: 'neutral' | 'danger';
  /** Opaque so undo can restore the exact row it deleted. */
  undo?: () => void;
  /** Opaque so dismiss can dismiss. */
  dismiss?: () => void;
  /** Token; a newer snackbar replaces an older one. */
  id: number;
};

type UiState = {
  sheet: SheetMode;
  snackbar: Snackbar | null;
  /** Ids to flash on the timeline after an optimistic insert or restore. */
  highlightId: string | null;
  openCreate: (options?: { startedAt?: Date; categoryId?: string }) => void;
  openEdit: (id: string) => void;
  closeSheet: () => void;
  showSnackbar: (snackbar: Omit<Snackbar, 'id'>) => void;
  dismissSnackbar: () => void;
  setHighlight: (id: string | null) => void;
};

let snackbarSeq = 0;

export const useUiStore = create<UiState>()((set, get) => ({
  sheet: { kind: 'closed' },
  snackbar: null,
  highlightId: null,

  openCreate: (options) =>
    set({ sheet: { kind: 'create', startedAt: options?.startedAt, categoryId: options?.categoryId } }),
  openEdit: (id) => set({ sheet: { kind: 'edit', id } }),
  closeSheet: () => set({ sheet: { kind: 'closed' } }),

  showSnackbar: (snackbar) => {
    snackbarSeq += 1;
    const id = snackbarSeq;
    // Replacing rather than queueing: a second action should supersede the first
    // message immediately, not after a timeout.
    get().snackbar?.dismiss?.();
    set({ snackbar: { ...snackbar, id } });
  },

  dismissSnackbar: () =>
    set((state) => {
      state.snackbar?.dismiss?.();
      return { snackbar: null };
    }),

  setHighlight: (highlightId) => set({ highlightId }),
}));