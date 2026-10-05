import type { SQLiteDatabase } from 'expo-sqlite';

import { createId } from '@/lib/id';
import { addDays, dayKey, parseDayKey, snapToStep } from '@/utils/time';

import * as activitiesRepo from './activitiesRepo';
import * as categoriesRepo from './categoriesRepo';

type SampleSpec = {
  /** Days before today. 0 is today, so the sample set always looks current. */
  daysAgo: number;
  /** Minutes from local midnight. Omitted means "continue from the last entry". */
  at?: number;
  title: string;
  categoryId: string;
  duration: number;
  notes?: string;
};

/**
 * A believable three weeks.
 *
 * Shaped rather than random, because the screens are being judged on whether they
 * look right with real content: weekday mornings are work-heavy, weekends are
 * lighter and more scattered, Friday evenings and Sunday mornings are mostly
 * empty, and the durations vary from a ten-minute errand to a four-hour block.
 * Two days are left deliberately blank so the calendar and Insights screens have
 * real empty states to render.
 */
const SAMPLE_ACTIVITIES: SampleSpec[] = [
  // ---- 20 days ago: Monday
  { daysAgo: 20, at: 8 * 60 + 30, title: 'Inbox zero before standup', categoryId: 'work', duration: 45, notes: 'Cleared the overnight backlog. Nothing urgent left.' },
  { daysAgo: 20, title: 'Migrated the settings module', categoryId: 'work', duration: 135 },
  { daysAgo: 20, at: 12 * 60 + 45, title: 'Lunch, reading at the counter', categoryId: 'personal', duration: 30 },
  { daysAgo: 20, at: 14 * 60, title: 'Linear algebra revision', categoryId: 'study', duration: 90, notes: 'Eigenvalues finally clicked.' },
  { daysAgo: 20, at: 18 * 60 + 15, title: 'Easy run, five kilometres', categoryId: 'health', duration: 40 },
  { daysAgo: 20, at: 21 * 60, title: 'Read two chapters', categoryId: 'personal', duration: 35 },

  // ---- 19 days ago
  { daysAgo: 19, at: 9 * 60, title: 'Refactor the sync layer', categoryId: 'work', duration: 150 },
  { daysAgo: 19, at: 13 * 60, title: 'Client call — Q3 scope', categoryId: 'work', duration: 60 },
  { daysAgo: 19, at: 17 * 60 + 30, title: 'Guitar practice', categoryId: 'personal', duration: 45 },
  { daysAgo: 19, at: 20 * 60, title: 'Dinner with Sam and Ines', categoryId: 'social', duration: 110 },

  // ---- 18 days ago: heavy day
  { daysAgo: 18, at: 8 * 60, title: 'Sprint work — offline mode', categoryId: 'work', duration: 210 },
  { daysAgo: 18, at: 12 * 60 + 30, title: 'Algorithms practice', categoryId: 'study', duration: 75 },
  { daysAgo: 18, at: 15 * 60, title: 'Design review prep', categoryId: 'work', duration: 90 },
  { daysAgo: 18, at: 19 * 60, title: 'Long walk, no headphones', categoryId: 'health', duration: 65 },
  { daysAgo: 18, at: 21 * 60 + 30, title: 'Journaling', categoryId: 'personal', duration: 20 },

  // ---- 17 days ago
  { daysAgo: 17, at: 9 * 60 + 15, title: 'Wrote the import parser', categoryId: 'work', duration: 120, notes: 'Handles the malformed rows the old exporter produced.' },
  { daysAgo: 17, at: 13 * 60 + 30, title: 'Course notes — databases', categoryId: 'study', duration: 80 },
  { daysAgo: 17, at: 18 * 60, title: 'Swim, 1500m', categoryId: 'health', duration: 50 },

  // ---- 16 days ago: Saturday
  { daysAgo: 16, at: 9 * 60, title: 'Farmers market', categoryId: 'personal', duration: 50 },
  { daysAgo: 16, at: 11 * 60, title: 'Sketching ideas', categoryId: 'ideas', duration: 65, notes: 'Three directions for the new onboarding flow.' },
  { daysAgo: 16, at: 15 * 60, title: 'Call home', categoryId: 'social', duration: 55 },
  { daysAgo: 16, at: 19 * 60, title: 'Roast and bread', categoryId: 'personal', duration: 90 },

  // ---- 15 days ago: Sunday, deliberately light
  { daysAgo: 15, at: 10 * 60 + 30, title: 'Coffee and the paper', categoryId: 'personal', duration: 60 },
  { daysAgo: 15, at: 16 * 60, title: 'Sortied', categoryId: 'health', duration: 95 },

  // ---- 14 days ago
  { daysAgo: 14, at: 8 * 60 + 45, title: 'Roadmap draft', categoryId: 'work', duration: 100 },
  { daysAgo: 14, at: 12 * 60, title: '1:1 with Priya', categoryId: 'work', duration: 45 },
  { daysAgo: 14, at: 14 * 60, title: 'Wrote the RFC', categoryId: 'ideas', duration: 120, notes: 'Storage layer. Sending tonight.' },
  { daysAgo: 14, at: 19 * 60, title: 'Yoga', categoryId: 'health', duration: 45 },

  // ---- 13 days ago
  { daysAgo: 13, at: 9 * 60, title: 'Shipped the settings screen', categoryId: 'work', duration: 135 },
  { daysAgo: 13, at: 13 * 60 + 15, title: 'Reading group', categoryId: 'study', duration: 70 },
  { daysAgo: 13, at: 18 * 60, title: 'Dinner with the team', categoryId: 'social', duration: 130 },
  { daysAgo: 13, at: 21 * 60, title: 'Guitar practice', categoryId: 'personal', duration: 40 },

  // ---- 12 days ago
  { daysAgo: 12, at: 8 * 60 + 30, title: 'Bug hunt — flaky sync test', categoryId: 'work', duration: 105 },
  { daysAgo: 12, at: 12 * 60 + 30, title: 'Statistics practice set', categoryId: 'study', duration: 60 },
  { daysAgo: 12, at: 17 * 60, title: 'Trail run', categoryId: 'health', duration: 55 },
  { daysAgo: 12, at: 20 * 60 + 30, title: 'Wrote the weekly note', categoryId: 'personal', duration: 25 },

  // ---- 11 days ago: Friday, quiet evening
  { daysAgo: 11, at: 9 * 60, title: 'Sprint work — calendar grid', categoryId: 'work', duration: 165 },
  { daysAgo: 11, at: 13 * 60, title: 'Lunch and a walk', categoryId: 'health', duration: 45 },
  { daysAgo: 11, at: 15 * 60, title: 'Refactoring tests', categoryId: 'work', duration: 75 },

  // ---- 10 days ago: Saturday
  { daysAgo: 10, at: 10 * 60, title: 'Coffee with Dad', categoryId: 'social', duration: 90 },
  { daysAgo: 10, at: 13 * 60 + 30, title: 'Hardware store', categoryId: 'personal', duration: 40 },
  { daysAgo: 10, at: 16 * 60, title: 'Bouldering', categoryId: 'health', duration: 80 },
  { daysAgo: 10, at: 20 * 60, title: 'Cooked properly', categoryId: 'personal', duration: 70 },

  // ---- 9 days ago: Sunday — left blank on purpose

  // ---- 8 days ago
  { daysAgo: 8, at: 8 * 60 + 45, title: 'Weekly planning', categoryId: 'work', duration: 40 },
  { daysAgo: 8, title: 'Deep work — export format', categoryId: 'work', duration: 120 },
  { daysAgo: 8, at: 13 * 60, title: 'Read the Kuzu paper', categoryId: 'study', duration: 65 },
  { daysAgo: 8, at: 17 * 60 + 30, title: 'Gym, legs', categoryId: 'health', duration: 65 },
  { daysAgo: 8, at: 21 * 60, title: 'Read two chapters', categoryId: 'personal', duration: 40 },

  // ---- 7 days ago
  { daysAgo: 7, at: 9 * 60, title: 'Code review queue', categoryId: 'work', duration: 90 },
  { daysAgo: 7, at: 12 * 60 + 30, title: 'Pairing with Tom', categoryId: 'work', duration: 105 },
  { daysAgo: 7, at: 16 * 60, title: 'Evening run', categoryId: 'health', duration: 35 },
  { daysAgo: 7, at: 19 * 60 + 30, title: 'Dinner with friends', categoryId: 'social', duration: 120 },

  // ---- 6 days ago
  { daysAgo: 6, at: 8 * 60 + 30, title: 'Standup and planning', categoryId: 'work', duration: 30 },
  { daysAgo: 6, title: 'Rewrote the query layer', categoryId: 'work', duration: 150 },
  { daysAgo: 6, at: 12 * 60 + 30, title: 'Linear algebra revision', categoryId: 'study', duration: 75 },
  { daysAgo: 6, at: 18 * 60, title: 'Trail run', categoryId: 'health', duration: 50 },

  // ---- 5 days ago
  { daysAgo: 5, at: 9 * 60 + 15, title: 'Client call', categoryId: 'work', duration: 60 },
  { daysAgo: 5, at: 11 * 60, title: 'Design review prep', categoryId: 'work', duration: 90 },
  { daysAgo: 5, at: 15 * 60, title: 'Guitar practice', categoryId: 'personal', duration: 45 },
  { daysAgo: 5, at: 21 * 60, title: 'Call home', categoryId: 'social', duration: 30 },

  // ---- 4 days ago
  { daysAgo: 4, at: 9 * 60, title: 'Sprint work — insights', categoryId: 'work', duration: 180 },
  { daysAgo: 4, at: 14 * 60, title: 'Algorithms practice', categoryId: 'study', duration: 60 },
  { daysAgo: 4, at: 19 * 60, title: 'Evening walk', categoryId: 'health', duration: 35 },

  // ---- 3 days ago
  { daysAgo: 3, at: 10 * 60, title: 'Roadmap draft', categoryId: 'work', duration: 90 },
  { daysAgo: 3, at: 13 * 60 + 30, title: 'Sketching ideas', categoryId: 'ideas', duration: 40, notes: 'Three directions for the new onboarding flow.' },
  { daysAgo: 3, at: 16 * 60, title: 'Yoga', categoryId: 'health', duration: 45 },
  { daysAgo: 3, at: 20 * 60, title: 'Movie with Alex', categoryId: 'social', duration: 140 },

  // ---- 2 days ago
  { daysAgo: 2, at: 8 * 60 + 45, title: 'Code review', categoryId: 'work', duration: 60 },
  { daysAgo: 2, title: 'Bug hunt', categoryId: 'work', duration: 105 },
  { daysAgo: 2, at: 13 * 60 + 30, title: 'Course notes', categoryId: 'study', duration: 80 },
  { daysAgo: 2, at: 20 * 60, title: 'Dinner with friends', categoryId: 'social', duration: 120 },

  // ---- 1 day ago
  { daysAgo: 1, at: 9 * 60, title: 'Wrote the export tests', categoryId: 'work', duration: 110 },
  { daysAgo: 1, at: 12 * 60 + 30, title: 'Read a paper on time series', categoryId: 'study', duration: 70, notes: 'Useful section on week-over-week deltas.' },
  { daysAgo: 1, at: 16 * 60, title: 'Gym', categoryId: 'health', duration: 60 },
  { daysAgo: 1, at: 21 * 60, title: 'Read two chapters', categoryId: 'personal', duration: 40 },

  // ---- today, still in progress
  { daysAgo: 0, at: 8 * 60 + 30, title: 'Morning review', categoryId: 'work', duration: 45 },
  { daysAgo: 0, at: 9 * 60 + 30, title: 'Shipping the timeline row', categoryId: 'work', duration: 150, notes: 'Swipe actions finally feel right.' },
  { daysAgo: 0, at: 13 * 60, title: 'Reading group', categoryId: 'study', duration: 60 },
  { daysAgo: 0, at: 15 * 60, title: 'Walked to the shop', categoryId: 'personal', duration: 15 },
];

function localTimeOn(key: string, minutesFromMidnight: number): Date {
  const parts = parseDayKey(key);
  if (!parts) return new Date(NaN);
  return new Date(
    parts.year,
    parts.month - 1,
    parts.day,
    Math.floor(minutesFromMidnight / 60),
    minutesFromMidnight % 60,
    0,
    0,
  );
}

/**
 * Writes the sample history.
 *
 * Entries without an explicit clock time are appended after the previous entry for
 * the same day, leaving a realistic gap between them — which is also what
 * populates the timeline's "unlogged" spacers. Today's last entry is clipped to
 * now, so the sample set never claims time that has not happened yet.
 */
export async function seedSampleData(db: SQLiteDatabase): Promise<void> {
  await categoriesRepo.seedDefaults(db);

  const byDay = new Map<string, SampleSpec[]>();
  for (const spec of SAMPLE_ACTIVITIES) {
    const key = dayKey(addDays(new Date(), -spec.daysAgo));
    const bucket = byDay.get(key) ?? [];
    bucket.push(spec);
    byDay.set(key, bucket);
  }

  const now = new Date();
  const nowKey = dayKey(now);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const [key, specs] of byDay) {
      let cursor = 7 * 60 + 30;

      for (const spec of specs) {
        const start = spec.at ?? snapToStep(cursor + 25, 5);
        cursor = start + spec.duration + 20;

        // Never seed an activity that has not finished yet.
        if (key === nowKey && start + spec.duration > nowMinutes) continue;

        const timestamp = new Date().toISOString();
        await txn.runAsync(
          `INSERT INTO activities
             (id, title, category_id, notes, started_at, day, duration_minutes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          createId(),
          spec.title,
          spec.categoryId,
          spec.notes ?? null,
          localTimeOn(key, start).toISOString(),
          key,
          spec.duration,
          timestamp,
          timestamp,
        );
      }
    }
  });
}

/** The first day of the sample window, for the calendar's initial range. */
export function sampleRange(today = new Date()): { from: string; to: string } {
  return { from: dayKey(addDays(today, -20)), to: dayKey(today) };
}

/**
 * Populates an empty database in development only.
 *
 * A production install must never show invented history, so this is gated on
 * `__DEV__` as well as on the database being empty.
 */
export async function seedIfEmptyAndDev(db: SQLiteDatabase): Promise<void> {
  if (!__DEV__) return;
  const activityCount = await activitiesRepo.count(db);
  if (activityCount > 0) return;
  await seedSampleData(db);
}