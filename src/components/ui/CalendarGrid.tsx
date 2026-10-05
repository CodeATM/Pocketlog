import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';

import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import { fromDayKey, isToday, weekdayInitials } from '@/utils/time';

import { IconButton } from './IconButton';
import { Text } from './Text';

export type DayCategory = {
  id: string;
  minutes: number;
  /** Full-strength category colour for this scheme. */
  solid: string;
};

export type DayDensity = {
  /** Total minutes logged that day. */
  minutes: number;
  /** 0–1 against the busiest day in the visible month. */
  share: number;
  /** Up to three categories, descending by minutes. */
  categories: DayCategory[];
};

type Props = {
  /** Six rows of seven day keys — see `monthGridKeys` in `utils/time`. */
  weeks: string[][];
  density: Record<string, DayDensity>;
  selectedKey: string | null;
  onSelect: (key: string) => void;
  weekStartsOn: number;
  monthLabel: string;
  /** Omitted when paging is disabled, which hides the arrows entirely. */
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  /** Label for the month caption; the visible label stays short. */
  monthAccessibilityLabel?: string;
};

const ARC_RADIUS = 5;
const ARC_SIZE = ARC_RADIUS * 2 + 3;
const ARC_CIRCUMFERENCE = 2 * Math.PI * ARC_RADIUS;
const MAX_ARC_CATEGORIES = 3;

/**
 * Custom month grid.
 *
 * Hand-built rather than taken from a date library, because the interesting part
 * is not the dates — it is the density indicator, and every stock calendar renders
 * that as a single dot under the number, discarding the only information worth
 * showing about a logged day.
 *
 * The indicator is a small ring beneath the numeral. Its sweep grows with time
 * logged (against the busiest day in the visible month, so the scale stays
 * meaningful when paging) and is divided into up to three arcs in the colours of
 * the categories that actually filled the day. The result reads like a printed
 * diary page: full days and empty days are obvious, and so is the flavour of a
 * busy afternoon.
 *
 * Selection is a filled accent plate with an inverted numeral; today is a ring, not
 * a fill, so "today" and "selected" can coexist without competing.
 *
 * Always six rows tall, so paging months never resizes the page.
 *
 * ```tsx
 * <CalendarGrid weeks={weeks} density={density} selectedKey={key} onSelect={setKey} weekStartsOn={1} />
 * ```
 */
export const CalendarGrid = memo(function CalendarGrid({
  weeks,
  density,
  selectedKey,
  onSelect,
  weekStartsOn,
  monthLabel,
  onPreviousMonth,
  onNextMonth,
  monthAccessibilityLabel,
}: Props) {
  const { colors } = useTheme();

  const initials = useMemo(() => weekdayInitials(weekStartsOn), [weekStartsOn]);
  const canPage = Boolean(onPreviousMonth && onNextMonth);

  return (
    <View accessible={false} style={styles.container}>
      {/* The month caption and its arrows are one control cluster: a screen reader
          reads it as "March 2026, previous month button, next month button" rather
          than as three unrelated items. */}
      <View style={styles.header}>
        {canPage ? (
          <IconButton
            name="chevron-left"
            label="Previous month"
            onPress={() => onPreviousMonth?.()}
          />
        ) : (
          <View style={styles.headerSpacer} />
        )}

        <Text
          variant="headline"
          align="center"
          numberOfLines={1}
          accessibilityLabel={monthAccessibilityLabel ?? monthLabel}
        >
          {monthLabel}
        </Text>

        {canPage ? (
          <IconButton name="chevron-right" label="Next month" onPress={() => onNextMonth?.()} />
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <Text variant="caption" tone="faint" align="center" numberOfLines={1}>
        ring = hours logged
      </Text>

      <View style={styles.weekdays}>
        {initials.map((initial, index) => (
          <View key={`${initial}-${index}`} style={styles.weekday}>
            <Text variant="caption" tone="faint" align="center">
              {initial}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((key) => {
              const date = fromDayKey(key);
              const selected = key === selectedKey;
              const today = isToday(date);
              const info = density[key];

              return (
                <Pressable
                  key={key}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={describeDay(key, info, selected, today)}
                  onPress={() => onSelect(key)}
                  style={styles.cell}
                >
                  <View
                    style={[
                      styles.numeralPlate,
                      {
                        backgroundColor: selected ? colors.accent : 'transparent',
                        borderColor: today ? colors.accent : 'transparent',
                        borderWidth: today && !selected ? 1.5 : 0,
                      },
                    ]}
                  >
                    <Text
                      variant="numericSmall"
                      align="center"
                      numberOfLines={1}
                      style={{
                        color: selected ? colors.onAccent : info ? colors.text : colors.textFaint,
                      }}
                    >
                      {date.getDate()}
                    </Text>
                  </View>

                  <DensityRing
                    share={info?.share ?? 0}
                    categories={info?.categories ?? []}
                    trackColor={colors.surfaceSunken}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
});

function describeDay(
  key: string,
  info: DayDensity | undefined,
  selected: boolean,
  today: boolean,
): string {
  const date = fromDayKey(key);
  const base = date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const suffix = selected ? '. Selected' : today ? '. Today' : '';
  if (!info || info.minutes === 0) return `${base}. Nothing logged${suffix}`;
  const hours = Math.round((info.minutes / 60) * 10) / 10;
  return `${base}, ${hours} ${hours === 1 ? 'hour' : 'hours'} logged${suffix}`;
}

/**
 * One day's density ring.
 *
 * A faint full circle is the scale; the coloured arcs are the day itself, sized by
 * total time and subdivided by category. At a glance: no ring means nothing logged,
 * a nick means a short day, a closed ring means it was full.
 */
const DensityRing = memo(function DensityRing({
  share,
  categories,
  trackColor,
}: {
  share: number;
  categories: DayCategory[];
  trackColor: string;
}) {
  if (share <= 0 || categories.length === 0) return <View style={styles.ringSlot} />;

  const total = categories.reduce((sum, category) => sum + category.minutes, 0);
  if (total <= 0) return <View style={styles.ringSlot} />;

  const sweep = Math.min(1, share) * ARC_CIRCUMFERENCE;
  let consumed = 0;

  const arcs = categories.slice(0, MAX_ARC_CATEGORIES).map((category) => {
    const shareOfDay = category.minutes / total;
    const length = Math.max(2, sweep * shareOfDay);
    const offset = -consumed;
    consumed += length;
    return { id: category.id, color: category.solid, length, offset };
  });

  const centre = ARC_SIZE / 2;

  return (
    <View style={styles.ringSlot}>
      <Svg width={ARC_SIZE} height={ARC_SIZE}>
        {/* Rotated so the sweep begins at twelve o'clock and reads clockwise, the
            way a stopwatch hand does. */}
        <G rotation={-90} origin={`${centre}, ${centre}`}>
          <Circle
            cx={centre}
            cy={centre}
            r={ARC_RADIUS}
            stroke={trackColor}
            strokeWidth={2}
            fill="none"
          />
          {arcs.map((arc) => (
            <Circle
              key={arc.id}
              cx={centre}
              cy={centre}
              r={ARC_RADIUS}
              stroke={arc.color}
              strokeWidth={2}
              strokeLinecap="butt"
              fill="none"
              strokeDasharray={`${arc.length} ${ARC_CIRCUMFERENCE}`}
              strokeDashoffset={arc.offset}
            />
          ))}
        </G>
      </Svg>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space.sm,
    paddingVertical: space.md,
    gap: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center' },
  /** Keeps the caption optically centred when one arrow is missing. */
  headerSpacer: { width: 44, height: 44 },
  weekdays: { flexDirection: 'row' },
  weekday: { flex: 1, alignItems: 'center' },
  grid: { gap: 2 },
  week: { flexDirection: 'row', gap: 2 },
  cell: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
  numeralPlate: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringSlot: { height: ARC_SIZE, alignItems: 'center', justifyContent: 'center' },
});