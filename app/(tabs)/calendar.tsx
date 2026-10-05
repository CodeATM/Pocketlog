import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  Button,
  CalendarGrid,
  EmptyState,
  SectionHeader,
  SkeletonTimeline,
  Text,
  TimelineGap,
  TimelineRow,
  type DayDensity,
  type TimelineItem,
} from '@/components/ui';
import { useActivitiesInRange, useCategoryTotals, useDayTotals } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { useAddActivity } from '@/hooks/useAddActivity';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/context';
import { space } from '@/theme/tokens';
import {
  addMinutes,
  addMonths,
  dayKey,
  formatDayHeading,
  formatDuration,
  formatMonthYear,
  fromDayKey,
  minutesBetween,
  monthGridKeys,
  startOfMonth,
} from '@/utils/time';

/**
 * Spoken weekday names for the week-start setting.
 *
 * The grid's visible weekday row is initials, which are useless read aloud, so the
 * month caption carries the long form instead.
 */
const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * Calendar.
 *
 * A month grid above the selected day's entries, rather than an infinite scroll of
 * weeks: the grid is the navigation and the list is the content, so paging months
 * with arrows keeps the scroll position meaningful and the two panes never disagree
 * about what you are looking at.
 *
 * Each cell's density ring is computed from a single range query for the whole month
 * rather than one query per cell, so paging months stays one read. A selected day
 * with no entries gets its own empty state: "no entries on this day" is information,
 * and it needs different copy from a month that has never been touched.
 *
 * Paging carries the selection with it, so the list below always shows the first of
 * the new month rather than an out-of-range day.
 *
 * ```tsx
 * <CalendarScreen />
 * ```
 */
export default function CalendarScreen() {
  const router = useRouter();
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();
  const { openCreate, openEdit, remove } = useAddActivity();
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);

  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(() => dayKey(new Date()));

  const weeks = useMemo(
    () => monthGridKeys(month.getFullYear(), month.getMonth(), weekStartsOn),
    [month, weekStartsOn],
  );

  const monthStart = dayKey(startOfMonth(month));
  const monthEnd = dayKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));

  const { data: dayTotals, isLoading: totalsLoading } = useDayTotals(monthStart, monthEnd);
  const { data: categoryTotals } = useCategoryTotals(monthStart, monthEnd);
  const { data: activities } = useActivitiesInRange(monthStart, monthEnd);

  /**
   * Density per day, relative to the busiest day in the visible month.
   *
   * Normalising against the month's own maximum rather than a fixed hour count means
   * a quiet week reads as uniformly light instead of every ring looking half-full.
   */
  const density = useMemo(() => {
    const minutesByDay = new Map<string, number>();
    for (const total of dayTotals ?? []) minutesByDay.set(total.day, total.minutes);

    // Category split comes from the month totals, so the ring's arcs describe the
    // month even on days whose own rows are not in view.
    const perDay = new Map<string, { id: string; minutes: number; solid: string }[]>();
    for (const activity of activities ?? []) {
      const bucket = perDay.get(activity.day) ?? [];
      bucket.push({ id: activity.categoryId, minutes: activity.durationMinutes, solid: '' });
      perDay.set(activity.day, bucket);
    }

    const busiest = Math.max(1, ...(dayTotals ?? []).map((total) => total.minutes));

    const result: Record<string, DayDensity> = {};
    for (const day of weeks.flat()) {
      const minutes = minutesByDay.get(day) ?? 0;
      const buckets = perDay.get(day) ?? [];

      // Merge the day's categories so the top three arcs are per category, not per entry.
      const merged = new Map<string, number>();
      for (const bucket of buckets) {
        merged.set(bucket.id, (merged.get(bucket.id) ?? 0) + bucket.minutes);
      }

      const paletteById = new Map(
        (categoryTotals ?? []).map((total) => [
          total.categoryId,
          scheme === 'dark' ? total.colorDark : total.colorLight,
        ]),
      );

      result[day] = {
        minutes,
        share: minutes / busiest,
        categories: [...merged.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([id, categoryMinutes]) => ({
            id,
            minutes: categoryMinutes,
            solid: paletteById.get(id) ?? category(id).solid,
          })),
      };
    }

    return result;
  }, [weeks, dayTotals, activities, categoryTotals, category, scheme]);

  const selectedActivities = useMemo(
    () => (activities ?? []).filter((activity) => activity.day === selected),
    [activities, selected],
  );

  const items = useMemo(() => {
    const output: (
      | { kind: 'gap'; key: string; minutes: number }
      | { kind: 'row'; key: string; item: TimelineItem }
    )[] = [];

    selectedActivities.forEach((activity, index) => {
      const startedAt = new Date(activity.startedAt);
      const previous = index > 0 ? selectedActivities[index - 1] : undefined;

      if (previous) {
        const previousEnd = addMinutes(new Date(previous.startedAt), previous.durationMinutes);
        const gap = minutesBetween(previousEnd, startedAt);
        if (gap >= 10) output.push({ kind: 'gap', key: `gap-${activity.id}`, minutes: gap });
      }

      output.push({
        kind: 'row',
        key: activity.id,
        item: {
          id: activity.id,
          title: activity.title,
          categoryName: activity.category.name,
          glyph: activity.category.icon,
          palette: category(
            activity.category.id,
            scheme === 'dark' ? activity.category.colorDark : activity.category.colorLight,
          ),
          startedAt,
          durationMinutes: activity.durationMinutes,
          notes: activity.notes,
          isFirst: index === 0,
          isLast: index === selectedActivities.length - 1,
        },
      });
    });

    return output;
  }, [selectedActivities, category, scheme]);

  const selectedTotal = useMemo(
    () => selectedActivities.reduce((total, activity) => total + activity.durationMinutes, 0),
    [selectedActivities],
  );

  // Same scale as the Today list, so a day's bars mean the same thing in both places.
  const longestBlock = useMemo(
    () =>
      Math.max(
        30,
        selectedActivities.reduce(
          (longest, activity) => Math.max(longest, activity.durationMinutes),
          0,
        ),
      ),
    [selectedActivities],
  );

  // Paging carries the selection to the first of the new month, so the list below
  // never points at a day the grid is no longer showing.
  const step = useCallback(
    (amount: number) => {
      haptics.light();
      const next = addMonths(month, amount);
      setMonth(next);
      setSelected(dayKey(next));
    },
    [month],
  );

  const isToday = selected === dayKey(new Date());

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <CalendarGrid
          weeks={weeks}
          density={density}
          selectedKey={selected}
          onSelect={(key) => {
            haptics.selection();
            setSelected(key);
          }}
          weekStartsOn={weekStartsOn}
          monthLabel={formatMonthYear(month)}
          monthAccessibilityLabel={`${formatMonthYear(month)}, week starts ${WEEKDAY_NAMES[weekStartsOn]}`}
          onPreviousMonth={() => step(-1)}
          onNextMonth={() => step(1)}
        />

        {totalsLoading ? <SkeletonTimeline rows={3} /> : null}

        <View style={styles.section}>
          <SectionHeader
            title={formatDayHeading(selected)}
            action={
              <Text variant="caption" tone="faint">
                {selectedTotal > 0 ? formatDuration(selectedTotal) : '—'}
              </Text>
            }
          />

          {selectedActivities.length === 0 ? (
            <EmptyState
              icon="calendar"
              title="No entries on this day"
              message={
                isToday
                  ? 'Nothing logged yet today.'
                  : 'Pick another day, or log something retroactively.'
              }
              layout="inline"
              action={
                <Button
                  label={isToday ? 'Log an activity' : 'Log on this day'}
                  // Midday for a retro entry rather than 00:00, which reads as the
                  // wrong day in some locales and always looks like a mistake.
                  onPress={() => openCreate({ startedAt: isToday ? new Date() : atMidday(selected) })}
                />
              }
            />
          ) : (
            items.map((entry, index) =>
              entry.kind === 'gap' ? (
                <TimelineGap key={entry.key} minutes={entry.minutes} first={index === 0} />
              ) : (
                <TimelineRow
                  key={entry.key}
                  item={entry.item}
                  scaleMaxMinutes={longestBlock}
                  onPress={() => router.push(`/activity/${entry.item.id}`)}
                  onEdit={() => openEdit(entry.item.id)}
                  onDelete={() => {
                    const activity = selectedActivities.find((row) => row.id === entry.item.id);
                    if (activity) void remove(activity);
                  }}
                />
              ),
            )
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function atMidday(key: string): Date {
  const base = fromDayKey(key);
  if (Number.isNaN(base.getTime())) return new Date();
  return new Date(base.getFullYear(), base.getMonth(), base.getDate(), 12, 0);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.xl },
  // No gap: `TimelineRow` draws its own connector between cards, so spacing is added
  // here only between an elapsed-time gap and the cards around it.
  section: { gap: space.sm, paddingTop: space.huge },
});