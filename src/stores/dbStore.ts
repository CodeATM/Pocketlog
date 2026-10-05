import { create } from 'zustand';

/**
 * A monotonic counter that stands in for query invalidation.
 *
 * SQLite has no cross-screen change notifications worth wiring up here, so every
 * mutation bumps this value and every query hook lists it as a dependency. That
 * keeps SQLite as the single source of truth — no query results are cached in
 * Zustand, only the "something changed" signal is.
 *
 * Deliberately not persisted: a stale revision across launches would be worse
 * than useless.
 */
type DbState = {
  revision: number;
  invalidate: () => void;
};

export const useDbStore = create<DbState>()((set) => ({
  revision: 0,
  invalidate: () => set((state) => ({ revision: state.revision + 1 })),
}));

/**
 * Runs a write and then invalidates queries.
 *
 * Invalidating after the write resolves (rather than before) means a hook that
 * re-runs mid-write can never read a half-applied transaction. Errors propagate
 * without bumping the counter, so a failed write leaves the UI untouched.
 */
export async function runMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = await operation();
  useDbStore.getState().invalidate();
  return result;
}