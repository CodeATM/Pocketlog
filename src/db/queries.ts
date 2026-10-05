import { useMemo } from 'react';

import * as activitiesRepo from '@/db/activitiesRepo';
import type { ActivityWithCategory } from '@/db/activitiesRepo';
import * as categoriesRepo from '@/db/categoriesRepo';
import * as statsRepo from '@/db/statsRepo';
import type { CategoryTotal, DayTotal, RangeTotals } from '@/db/statsRepo';
import { useQuery } from '@/hooks/useQuery';
import type { Category } from '@/types/category';
import { addDays, dayKey, fromDayKey } from '@/utils/time';

/**
 * The read side of the app.
 *
 * Screens call these hooks; they never touch SQLite directly and never hold query
 * results in their own state. Everything re-reads when the database revision
 * changes, which is what makes an optimistic insert, an undo and an import all
 * behave the same way with no per-screen bookkeeping.
 */

export function useCategories() {
  return useQuery<Category[]>((db) => categoriesRepo.listAll(db), []);
}

/**
 * Today, via `useTodayKey`, so the window follows the clock across midnight instead of
 * being pinned to whatever day the app happened to start on.
 */
export function useTodayActivities(today: string) {
  return useQuery<ActivityWithCategory[]>((db) => activitiesRepo.listByDay(db, today), [today]);
}

export function useActivitiesByDay(day: string) {
  return useQuery<ActivityWithCategory[]>((db) => activitiesRepo.listByDay(db, day), [day]);
}

export function useActivity(id: string | undefined) {
  return useQuery<ActivityWithCategory | null>(
    (db) => (id ? activitiesRepo.getById(db, id) : Promise.resolve(null)),
    [id ?? null],
  );
}

/**
 * Every activity in the inclusive day range, ascending by start time.
 *
 * Today and Calendar both need "a chronological list for these days", so they share
 * this one hook rather than each composing their own.
 */
export function useActivitiesInRange(fromDay: string, toDay: string) {
  return useQuery<ActivityWithCategory[]>(
    (db) => activitiesRepo.listRangeAscending(db, fromDay, toDay),
    [fromDay, toDay],
  );
}

/**
 * Search over titles, notes and category names, optionally filtered by category.
 *
 * An empty term short-circuits to an empty result rather than issuing a query, so
 * the recent-search list is what the screen shows before anything is typed.
 */
export function useSearchResults(term: string, categoryIds: readonly string[] = []) {
  const trimmed = term.trim();
  const filter = [...categoryIds].sort().join(',');

  return useQuery<ActivityWithCategory[]>(
    (db) =>
      trimmed.length === 0
        ? Promise.resolve([])
        : activitiesRepo.search(db, trimmed, filter.length > 0 ? filter.split(',') : [], 200),
    [trimmed, filter],
  );
}

export function useDayTotals(fromDay: string, toDay: string) {
  return useQuery<DayTotal[]>((db) => statsRepo.getDayTotals(db, fromDay, toDay), [
    fromDay,
    toDay,
  ]);
}

export function useCategoryTotals(fromDay: string, toDay: string) {
  return useQuery<CategoryTotal[]>((db) => statsRepo.getCategoryTotals(db, fromDay, toDay), [
    fromDay,
    toDay,
  ]);
}

export function useRangeTotals(fromDay: string, toDay: string) {
  return useQuery<RangeTotals>((db) => statsRepo.getRangeTotals(db, fromDay, toDay), [
    fromDay,
    toDay,
  ]);
}

/**
 * Per-day totals for a run of days ending today, used for the calendar's density
 * rings. Computed from a single range query rather than one query per day.
 */
export function useRecentDayTotals(days: number) {
  const today = dayKey(new Date());
  const from = dayKey(addDays(fromDayKey(today), -(days - 1)));
  return useQuery<DayTotal[]>((db) => statsRepo.getDayTotals(db, from, today), [from, today]);
}

export function useActivityCount() {
  return useQuery<number>((db) => activitiesRepo.count(db), []);
}

/** Total minutes plus the count of entries on one day — the home summary. */
export function useDaySummary(day: string) {
  const range = useRangeTotals(day, day);
  return useMemo(
    () => ({
      minutes: range.data?.minutes ?? 0,
      count: range.data?.count ?? 0,
      isLoading: range.isLoading,
    }),
    [range.data, range.isLoading],
  );
}