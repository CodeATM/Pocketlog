import type { SQLiteDatabase } from 'expo-sqlite';

import { createId } from '@/lib/id';
import { dayKey } from '@/utils/time';
import type { Activity, ActivityDraft, ActivityPatch } from '@/types/activity';
import type { Category } from '@/types/category';

/** An activity joined with its category, which every list screen needs. */
export type ActivityWithCategory = Activity & {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'colorLight' | 'colorDark'>;
};

type ActivityRow = {
  id: string;
  title: string;
  category_id: string;
  notes: string | null;
  started_at: string;
  day: string;
  duration_minutes: number;
  created_at: string;
  updated_at: string;
  category_name: string;
  category_icon: string;
  category_color_light: string;
  category_color_dark: string;
};

/**
 * Column list for the activity+category join. Written once so every read path
 * hydrates rows identically and `ActivityWithCategory` stays honest.
 */
const JOIN_COLUMNS = `
  a.id, a.title, a.category_id, a.notes, a.started_at, a.day,
  a.duration_minutes, a.created_at, a.updated_at,
  c.name AS category_name, c.icon AS category_icon,
  c.color_light AS category_color_light, c.color_dark AS category_color_dark
`;

const FROM_JOIN = `
  FROM activities a
  JOIN categories c ON c.id = a.category_id
`;

function hydrate(row: ActivityRow): ActivityWithCategory {
  return {
    id: row.id,
    title: row.title,
    categoryId: row.category_id,
    notes: row.notes,
    startedAt: row.started_at,
    day: row.day,
    durationMinutes: row.duration_minutes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    category: {
      id: row.category_id,
      name: row.category_name,
      icon: row.category_icon,
      colorLight: row.category_color_light,
      colorDark: row.category_color_dark,
    },
  };
}

/** `('?','?')` placeholders for an `IN` list, so day lists are fully parameterised. */
function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

export async function getById(
  db: SQLiteDatabase,
  id: string,
): Promise<ActivityWithCategory | null> {
  const row = await db.getFirstAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN} WHERE a.id = ?`,
    id,
  );
  return row ? hydrate(row) : null;
}

export async function listByDay(
  db: SQLiteDatabase,
  day: string,
): Promise<ActivityWithCategory[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN} WHERE a.day = ? ORDER BY a.started_at ASC, a.created_at ASC`,
    day,
  );
  return rows.map(hydrate);
}

/** Ascending by start time across an inclusive day range — the timeline order. */
export async function listRangeAscending(
  db: SQLiteDatabase,
  fromDay: string,
  toDay: string,
): Promise<ActivityWithCategory[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN}
     WHERE a.day BETWEEN ? AND ?
     ORDER BY a.day ASC, a.started_at ASC, a.created_at ASC`,
    fromDay,
    toDay,
  );
  return rows.map(hydrate);
}

/** Newest first, then newest activity first within each day. */
export async function listByDays(
  db: SQLiteDatabase,
  days: string[],
): Promise<ActivityWithCategory[]> {
  if (days.length === 0) return [];
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN}
     WHERE a.day IN (${placeholders(days.length)})
     ORDER BY a.day DESC, a.started_at DESC, a.created_at DESC`,
    days,
  );
  return rows.map(hydrate);
}

export async function listRange(
  db: SQLiteDatabase,
  fromDay: string,
  toDay: string,
): Promise<ActivityWithCategory[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN}
     WHERE a.day BETWEEN ? AND ?
     ORDER BY a.day DESC, a.started_at DESC`,
    fromDay,
    toDay,
  );
  return rows.map(hydrate);
}

/** Distinct days that have at least one activity, newest first. */
export async function listDaysWithActivity(
  db: SQLiteDatabase,
  limit: number,
): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>(
    'SELECT DISTINCT day FROM activities ORDER BY day DESC LIMIT ?',
    limit,
  );
  return rows.map((row) => row.day);
}

export async function listAll(db: SQLiteDatabase): Promise<ActivityWithCategory[]> {
  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN} ORDER BY a.started_at ASC`,
  );
  return rows.map(hydrate);
}

/**
 * Case-insensitive substring search over titles, notes and category names,
 * optionally restricted to a set of categories.
 *
 * Deliberately `LIKE` rather than FTS5: a personal logger holds hundreds to a few
 * thousand rows, where a single indexed scan is imperceptible, and avoiding a
 * virtual table keeps migrations, imports and deletes free of FTS rebuilds.
 *
 * The category filter is applied in SQL with a parameterised `IN` list rather than
 * by filtering in JS, so an unfiltered term and a filtered one stay the same cost.
 */
export async function search(
  db: SQLiteDatabase,
  query: string,
  categoryIds: readonly string[] = [],
  limit = 100,
): Promise<ActivityWithCategory[]> {
  const needle = `%${query.trim().replace(/[%_]/g, (char) => `\\${char}`)}%`;
  const clauses = [`(a.title LIKE ? ESCAPE '\\' OR a.notes LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\')`];
  const params: (string | number)[] = [needle, needle, needle];

  if (categoryIds.length > 0) {
    clauses.push(`a.category_id IN (${placeholders(categoryIds.length)})`);
    params.push(...categoryIds);
  }

  params.push(limit);

  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT ${JOIN_COLUMNS} ${FROM_JOIN}
     WHERE ${clauses.join(' AND ')}
     ORDER BY a.started_at DESC
     LIMIT ?`,
    ...params,
  );
  return rows.map(hydrate);
}

/**
 * Restores a deleted activity with its original id and timestamps.
 *
 * Used by the undo snackbar. `INSERT OR REPLACE` rather than `create` because the
 * row has to come back exactly as it was — a restored entry that jumped to the
 * bottom of the timeline, or changed id, would be a visible lie about history.
 */
export async function restore(db: SQLiteDatabase, activity: Activity): Promise<void> {
  await db.runAsync(
    `INSERT OR REPLACE INTO activities
       (id, title, category_id, notes, started_at, day, duration_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.title,
    activity.categoryId,
    activity.notes,
    activity.startedAt,
    activity.day,
    activity.durationMinutes,
    activity.createdAt,
    activity.updatedAt,
  );
}

export async function create(db: SQLiteDatabase, draft: ActivityDraft): Promise<Activity> {
  const now = new Date().toISOString();
  const activity: Activity = {
    id: createId(),
    title: draft.title.trim(),
    categoryId: draft.categoryId,
    notes: draft.notes?.trim() ? draft.notes.trim() : null,
    startedAt: draft.startedAt.toISOString(),
    day: dayKey(draft.startedAt),
    durationMinutes: Math.round(draft.durationMinutes),
    createdAt: now,
    updatedAt: now,
  };

  await db.runAsync(
    `INSERT INTO activities
       (id, title, category_id, notes, started_at, day, duration_minutes, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    activity.id,
    activity.title,
    activity.categoryId,
    activity.notes,
    activity.startedAt,
    activity.day,
    activity.durationMinutes,
    activity.createdAt,
    activity.updatedAt,
  );

  return activity;
}

export async function update(
  db: SQLiteDatabase,
  id: string,
  patch: ActivityPatch,
): Promise<Activity> {
  const activity: Activity = {
    id,
    title: patch.title.trim(),
    categoryId: patch.categoryId,
    notes: patch.notes?.trim() ? patch.notes.trim() : null,
    startedAt: patch.startedAt.toISOString(),
    // Recomputed from the (possibly changed) start time so editing an entry's
    // date moves it between day groups without a separate backfill step.
    day: dayKey(patch.startedAt),
    durationMinutes: Math.round(patch.durationMinutes),
    createdAt: '',
    updatedAt: new Date().toISOString(),
  };

  await db.runAsync(
    `UPDATE activities
        SET title = ?, category_id = ?, notes = ?, started_at = ?,
            day = ?, duration_minutes = ?, updated_at = ?
      WHERE id = ?`,
    activity.title,
    activity.categoryId,
    activity.notes,
    activity.startedAt,
    activity.day,
    activity.durationMinutes,
    activity.updatedAt,
    id,
  );

  return activity;
}

export async function remove(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM activities WHERE id = ?', id);
}

export async function count(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) AS count FROM activities',
  );
  return row?.count ?? 0;
}

/** Wipes every activity but keeps categories, for the "clear data" action. */
export async function deleteAll(db: SQLiteDatabase): Promise<void> {
  await db.runAsync('DELETE FROM activities');
}

/**
 * Replaces the entire activity table in one transaction, used by JSON import.
 * Categories are expected to already exist (they are seeded, not user-created).
 */
export async function replaceAll(db: SQLiteDatabase, activities: Activity[]): Promise<void> {
  await db.withExclusiveTransactionAsync(async (txn) => {
    await txn.runAsync('DELETE FROM activities');
    for (const activity of activities) {
      await txn.runAsync(
        `INSERT INTO activities
           (id, title, category_id, notes, started_at, day, duration_minutes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        activity.id,
        activity.title,
        activity.categoryId,
        activity.notes,
        activity.startedAt,
        activity.day,
        activity.durationMinutes,
        activity.createdAt,
        activity.updatedAt,
      );
    }
  });
}