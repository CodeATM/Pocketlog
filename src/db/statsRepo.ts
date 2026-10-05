import type { SQLiteDatabase } from 'expo-sqlite';

import { addDays, dayKey, dayKeyRange } from '@/utils/time';

export type DayTotal = {
  day: string;
  minutes: number;
  count: number;
};

export type CategoryTotal = {
  categoryId: string;
  name: string;
  colorLight: string;
  colorDark: string;
  minutes: number;
  count: number;
};

export type RangeTotals = {
  minutes: number;
  count: number;
  activeDays: number;
};

export type Streak = {
  /** Consecutive active days ending today, or ending yesterday if today is empty. */
  current: number;
  longest: number;
};

/** Per-day totals across an inclusive range, with empty days omitted. */
export async function getDayTotals(
  db: SQLiteDatabase,
  fromDay: string,
  toDay: string,
): Promise<DayTotal[]> {
  return db.getAllAsync<DayTotal>(
    `SELECT day, SUM(duration_minutes) AS minutes, COUNT(*) AS count
       FROM activities
      WHERE day BETWEEN ? AND ?
      GROUP BY day
      ORDER BY day ASC`,
    fromDay,
    toDay,
  );
}

export async function getCategoryTotals(
  db: SQLiteDatabase,
  fromDay: string,
  toDay: string,
): Promise<CategoryTotal[]> {
  return db.getAllAsync<CategoryTotal>(
    `SELECT c.id AS categoryId,
            c.name AS name,
            c.color_light AS colorLight,
            c.color_dark AS colorDark,
            SUM(a.duration_minutes) AS minutes,
            COUNT(*) AS count
       FROM activities a
       JOIN categories c ON c.id = a.category_id
      WHERE a.day BETWEEN ? AND ?
      GROUP BY c.id
      ORDER BY minutes DESC`,
    fromDay,
    toDay,
  );
}

export async function getRangeTotals(
  db: SQLiteDatabase,
  fromDay: string,
  toDay: string,
): Promise<RangeTotals> {
  const row = await db.getFirstAsync<{ minutes: number | null; count: number; activeDays: number }>(
    `SELECT SUM(duration_minutes) AS minutes,
            COUNT(*) AS count,
            COUNT(DISTINCT day) AS activeDays
       FROM activities
      WHERE day BETWEEN ? AND ?`,
    fromDay,
    toDay,
  );
  return {
    minutes: row?.minutes ?? 0,
    count: row?.count ?? 0,
    activeDays: row?.activeDays ?? 0,
  };
}

/** Every day that has at least one activity, newest first. */
export async function getActiveDays(db: SQLiteDatabase): Promise<string[]> {
  const rows = await db.getAllAsync<{ day: string }>(
    'SELECT DISTINCT day FROM activities ORDER BY day DESC',
  );
  return rows.map((row) => row.day);
}

/**
 * Consecutive-day streaks.
 *
 * A streak stays alive if yesterday was active even when today is not, so the
 * current count does not appear to reset every midnight before the user logs
 * anything.
 */
export function computeStreak(activeDaysDesc: string[], today: Date = new Date()): Streak {
  if (activeDaysDesc.length === 0) return { current: 0, longest: 0 };

  const active = new Set(activeDaysDesc);
  const todayKey = dayKey(today);
  const yesterdayKey = dayKey(addDays(today, -1));

  let current = 0;
  let cursor: Date;
  if (active.has(todayKey)) {
    cursor = today;
  } else if (active.has(yesterdayKey)) {
    cursor = addDays(today, -1);
  } else {
    cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 2);
  }

  while (active.has(dayKey(cursor))) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  let previous: string | null = null;
  for (const day of [...activeDaysDesc].sort()) {
    if (previous !== null && dayKeyRange(previous, day).length === 2) {
      run += 1;
    } else {
      run = 1;
    }
    longest = Math.max(longest, run);
    previous = day;
  }

  return { current, longest };
}

/** Mean minutes per day over the last `days` days, counting inactive days as zero. */
export async function getDailyAverage(
  db: SQLiteDatabase,
  days: number,
  today: Date = new Date(),
): Promise<number> {
  const end = today;
  const start = addDays(end, -(days - 1));
  const totals = await getRangeTotals(db, dayKey(start), dayKey(end));
  return days > 0 ? totals.minutes / days : 0;
}

export async function getFirstActivityDay(db: SQLiteDatabase): Promise<string | null> {
  const row = await db.getFirstAsync<{ day: string }>(
    'SELECT day FROM activities ORDER BY day ASC LIMIT 1',
  );
  return row?.day ?? null;
}