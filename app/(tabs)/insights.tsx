import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarChart,
  BarTooltip,
  Card,
  CountUpNumber,
  EmptyState,
  SegmentedControl,
  Skeleton,
  Text,
  type BarDatum,
} from '@/components/ui';
import {
  useCategoryTotals,
  useDayTotals,
  useRangeTotals,
} from '@/db/queries';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import {
  addDays,
  dayKey,
  formatDayHeading,
  formatDelta,
  formatDuration,
  fromDayKey,
  shareOfDay,
} from '@/utils/time';

type RangeKey = '7d' | '30d';

const RANGES: { value: RangeKey; label: string; days: number }[] = [
  { value: '7d', label: '7 days', days: 7 },
  { value: '30d', label: '30 days', days: 30 },
];

const HOUR_BUDGET = 8 * 60;

/**
 * Insights.
 *
 * Three things a person can actually act on, in order of how often they want them:
 * the total and whether it moved, the shape of each day, and where the time went.
 * Everything is derived from the same range, so switching 7 days to 30 re-reads once
 * and every number on the screen comes from that single read.
 *
 * The comparison is against the *preceding* window of the same length, not a weekly
 * average, because "am I doing more than last week" is the question that changes
 * behaviour, and comparing equal-length windows makes the delta honest even when the
 * two windows straddle a month boundary.
 *
 * Charts get a range switch rather than a zoom gesture: with thirty bars at most,
 * horizontal space is a poor second dimension and a segmented control is both
 * faster and reachable with a screen reader.
 *
 * ```tsx
 * <InsightsScreen />
 * ```
 */
export default function InsightsScreen() {
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();

  const [range, setRange] = useState<RangeKey>('7d');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const days = RANGES.find((option) => option.value === range)?.days ?? 7;

  // Live day key rather than `new Date()` in the render body: the window end has to
  // be a stable dependency, or every range memo re-runs on every render, and a
  // session left open past midnight would keep reporting yesterday.
  const todayKey = useTodayKey();
  // Derived once per day so `today` is a stable dependency for the memos below.
  const today = useMemo(() => fromDayKey(todayKey), [todayKey]);

  const from = dayKey(addDays(today, -(days - 1)));
  const to = todayKey;
  const previousFrom = dayKey(addDays(today, -(days * 2 - 1)));
  const previousTo = dayKey(addDays(today, -days));

  const current = useRangeTotals(from, to);
  const previous = useRangeTotals(previousFrom, previousTo);
  const { data: dayTotals } = useDayTotals(from, to);
  const { data: categoryTotals } = useCategoryTotals(from, to);

  /** One bar per day in the window, including empty ones: a gap is information. */
  const bars = useMemo<BarDatum[]>(() => {
    const byDay = new Map((dayTotals ?? []).map((total) => [total.day, total.minutes]));

    return Array.from({ length: days }, (_, index) => {
      const key = dayKey(addDays(today, -(days - 1 - index)));
      const date = fromDayKey(key);
      const minutes = byDay.get(key) ?? 0;

      return {
        key,
        label: String(date.getDate()),
        fullLabel: formatDayHeading(key),
        totalMinutes: minutes,
        isCurrent: index === days - 1,
        // A single-series chart is honest here: splitting one day by category needs a
        // query per day, and at this density the shape of the day matters more than
        // how it was divided.
        stacks: [
          {
            id: 'total',
            name: 'Logged',
            color: minutes > 0 ? colors.accent : colors.surfaceSunken,
            minutes,
          },
        ],
      };
    });
  }, [days, dayTotals, today, colors]);

  const selected = useMemo(
    () => bars.find((bar) => bar.key === selectedKey) ?? null,
    [bars, selectedKey],
  );

  /** Category totals as tap targets, largest first. */
  const breakdown = useMemo(
    () =>
      (categoryTotals ?? [])
        .filter((total) => total.minutes > 0)
        .map((total) => ({
          id: total.categoryId,
          label: total.name,
          minutes: total.minutes,
          palette: category(total.categoryId, scheme === 'dark' ? total.colorDark : total.colorLight),
        })),
    [categoryTotals, category, scheme],
  );

  const hasData = (current.data?.count ?? 0) > 0;

  if (!hasData && !current.isLoading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text variant="title1">Insights</Text>
        </View>
        <EmptyState
          icon="insights"
          title="Nothing to chart yet"
          message="Once a few days are logged, this is where the shape of them shows up."
        />
      </View>
    );
  }

  const minutes = current.data?.minutes ?? 0;
  const perDay = days > 0 ? minutes / days : 0;
  const delta = formatDelta(minutes, previous.data?.minutes ?? 0);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <Text variant="title1">Insights</Text>
            <SegmentedControl
              value={range}
              onChange={(next) => {
                setRange(next);
                setSelectedKey(null);
              }}
              options={RANGES}
            />
          </View>
        </View>

        <Card>
          {current.isLoading ? (
            <View style={styles.tiles}>
              <Skeleton width={120} height={40} />
              <Skeleton width={120} height={18} />
            </View>
          ) : (
            <View style={styles.tiles}>
              <View style={styles.tile}>
                <Text variant="caption" tone="muted">
                  Total
                </Text>
                <CountUpNumber value={Math.round(minutes / 60)} suffix="h" />
                <Text variant="caption" tone={delta.startsWith('+') ? 'success' : delta.startsWith('-') ? 'danger' : 'faint'}>
                  {delta} vs previous {days} days
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.tile}>
                <Text variant="caption" tone="muted">
                  Per day
                </Text>
                <Text variant="numericSmall">{formatDuration(Math.round(perDay))}</Text>
                <Text variant="caption" tone="faint">
                  {current.data?.activeDays ?? 0} of {days} days active
                </Text>
              </View>
            </View>
          )}
        </Card>

        <View style={styles.section}>
          <Text variant="caption" tone="muted">
            By day
          </Text>
          <BarChart
            data={bars}
            selectedKey={selectedKey}
            onSelect={(datum) => setSelectedKey(datum?.key ?? null)}
          />
          {selected ? (
            <View style={styles.tooltip}>
              <BarTooltip datum={selected} />
            </View>
          ) : (
            <Text variant="caption" tone="faint" align="center">
              Tap a column for that day
            </Text>
          )}
        </View>

        <View style={styles.section}>
          <Text variant="caption" tone="muted">
            Where it went
          </Text>

          {breakdown.length === 0 ? (
            <Text variant="body" tone="faint">
              No categories in this range yet.
            </Text>
          ) : (
            breakdown.map((entry, index) => (
              <View key={entry.id} style={styles.breakdownRow}>
                <View style={[styles.swatch, { backgroundColor: entry.palette.solid }]} />
                <Text variant="body" style={styles.breakdownLabel} numberOfLines={1}>
                  {entry.label}
                </Text>
                <Text variant="body" tone="muted">
                  {minutes > 0 ? `${Math.round((entry.minutes / minutes) * 100)}%` : '—'}
                </Text>
                <Text variant="numericSmall" style={styles.breakdownValue}>
                  {formatDuration(entry.minutes)}
                </Text>
                <View
                  style={[
                    styles.track,
                    { backgroundColor: colors.surfaceSunken, opacity: index === 0 ? 1 : 0.72 - index * 0.12 },
                  ]}
                />
              </View>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text variant="caption" tone="muted">
            Against an {HOUR_BUDGET / 60}-hour day
          </Text>
          <Text variant="body" tone="faint">
            {shareOfDay(minutes / days / HOUR_BUDGET) >= 1
              ? `Averaging over ${HOUR_BUDGET / 60} hours of logged time a day.`
              : `Averaging ${formatDuration(perDay)} a day — ${Math.round(
                  shareOfDay(perDay / HOUR_BUDGET) * 100,
                )}% of an eight-hour day.`}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: space.xl },
  header: { paddingTop: space.lg, paddingBottom: space.lg },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  tiles: { flexDirection: 'row', gap: space.lg },
  tile: { flex: 1, gap: space.xs },
  divider: { width: StyleSheet.hairlineWidth, backgroundColor: undefined },
  section: { gap: space.md, paddingTop: space.xl },
  tooltip: { alignItems: 'center' },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 10, height: 10, borderRadius: radius.pill },
  breakdownLabel: { flex: 1 },
  breakdownValue: { width: 64, textAlign: 'right' },
  track: { position: 'absolute', left: 0, right: 0, bottom: -6, height: 2, borderRadius: radius.pill },
});