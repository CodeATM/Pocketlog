import { useSQLiteContext } from 'expo-sqlite';
import { useCallback } from 'react';

import * as activitiesRepo from '@/db/activitiesRepo';
import { haptics } from '@/lib/haptics';
import { runMutation } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import type { Activity, ActivityDraft } from '@/types/activity';
import { addMinutes } from '@/utils/time';

/**
 * The one way an activity is created, updated or deleted.
 *
 * Every screen — the floating button, quick capture on Home, a timeline swipe, the
 * Details screen — goes through this hook, which is what keeps three guarantees in
 * one place:
 *
 * 1. **SQLite is the only writer.** Every mutation goes through `runMutation`, which
 *    bumps the database revision so mounted queries re-read. No screen keeps its own
 *    copy of a row, so an insert, an undo and an import all behave identically without
 *    per-screen bookkeeping. Writes are not optimistic: a local SQLite insert lands in
 *    well under a frame, and inventing a temporary row to show for that window would
 *    add a rollback path for no perceptible gain. The sheet keeps its values and stays
 *    open if a write fails, which is the failure that actually matters.
 * 2. **Destructive actions are undoable, not confirmed.** `remove` takes the row it
 *    deleted so the caller can offer a restore that puts back the original id,
 *    timestamps and position in the timeline.
 * 3. **Haptics only on commit.** Save ticks, delete warns, nothing else.
 */
export function useAddActivity() {
  const db = useSQLiteContext();
  const openCreate = useUiStore((state) => state.openCreate);
  const openEdit = useUiStore((state) => state.openEdit);
  const showSnackbar = useUiStore((state) => state.showSnackbar);
  const setHighlight = useUiStore((state) => state.setHighlight);
  const defaultCategoryId = useSettingsStore((state) => state.defaultCategoryId);
  const defaultDurationMinutes = useSettingsStore((state) => state.defaultDurationMinutes);

  const create = useCallback(
    async (draft: ActivityDraft): Promise<Activity> => {
      const created = await runMutation(() => activitiesRepo.create(db, draft));
      haptics.success();
      return created;
    },
    [db],
  );

  const update = useCallback(
    async (id: string, draft: ActivityDraft): Promise<Activity> => {
      const updated = await runMutation(() => activitiesRepo.update(db, id, draft));
      haptics.success();
      return updated;
    },
    [db],
  );

  /** Deletes and immediately offers an undo. Returns the removed row. */
  const remove = useCallback(
    async (activity: Activity): Promise<void> => {
      await runMutation(() => activitiesRepo.remove(db, activity.id));
      haptics.warning();

      showSnackbar({
        message: `Deleted “${activity.title}”`,
        tone: 'danger',
        dismiss: () => undefined,
        undo: () => {
          void runMutation(() => activitiesRepo.restore(db, activity)).then(() => {
            haptics.success();
            setHighlight(activity.id);
          });
        },
      });
    },
    [db, showSnackbar, setHighlight],
  );

  /** Restores a deleted activity verbatim, without a snackbar of its own. */
  const restore = useCallback(
    async (activity: Activity): Promise<void> => {
      await runMutation(() => activitiesRepo.restore(db, activity));
      haptics.success();
      setHighlight(activity.id);
    },
    [db, setHighlight],
  );

  /** Quick capture: title + default category + default duration, starting now. */
  const quickCapture = useCallback(
    async (title: string): Promise<Activity | null> => {
      const trimmed = title.trim();
      if (trimmed.length === 0) return null;

      const startedAt = new Date();
      return create({
        title: trimmed,
        categoryId: defaultCategoryId,
        startedAt,
        durationMinutes: defaultDurationMinutes,
      });
    },
    [create, defaultCategoryId, defaultDurationMinutes],
  );

  /** Computed end instant for a start/duration pair — used by previews and a11y. */
  const endOf = useCallback(
    (startedAt: Date, durationMinutes: number) => addMinutes(startedAt, durationMinutes),
    [],
  );

  return {
    /** Opens the shared sheet. Available from every screen. */
    openCreate: (options?: { startedAt?: Date; categoryId?: string }) => openCreate(options),
    openEdit,
    create,
    update,
    remove,
    restore,
    quickCapture,
    endOf,
    defaults: { categoryId: defaultCategoryId, durationMinutes: defaultDurationMinutes },
  };
}