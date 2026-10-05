import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import {
  addMonths,
  dayKey,
  fromDayKey,
  formatMonthYear,
  isToday,
  monthGridKeys,
  startOfMonth,
  todayKey,
  weekdayInitials,
} from '@/utils/time';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  /** Selected day as `YYYY-MM-DD`. */
  value: string;
  onChange: (key: string) => void;
  weekStartsOn: number;
  /**
   * Days after this key are not selectable. Defaults to today, which is what a
   * log of your own time wants: you cannot have done something that has not
   * happened yet.
   */
  maxKey?: string;
};

const CELL = 46;
const ROWS = 6;

/**
 * Inline month grid for picking a day.
 *
 * Replaces `DateTimePicker` because the platform control is a full-screen dialog on
 * Android and a wheel on iOS — neither keeps the sheet's context, and both hide the
 * durations already logged. This is the same grid language as the Calendar tab, so
 * the two screens read as one calendar.
 *
 * Selection is a filled accent plate, today is a ring, and out-of-month days are
 * dimmed but still tappable, so paging into an adjacent month does not require a
 * second gesture to reach it. Days past `maxKey` are inert.
 *
 * ```tsx
 * <DatePicker value={dayKey} onChange={setDayKey} weekStartsOn={1} />
 * ```
 */
export function DatePicker({ value, onChange, weekStartsOn, maxKey = todayKey() }: Props) {
  const { colors } = useTheme();
  const [cursor, setCursor] = useState(() => startOfMonth(fromDayKey(value)));
  const [syncedValue, setSyncedValue] = useState(value);

  // Follow the value when it changes from outside (a reset back to today), but do
  // not fight the user: paging the cursor alone leaves `value` untouched. Adjusting
  // during render rather than in an effect avoids the extra pass.
  if (value !== syncedValue) {
    setSyncedValue(value);
    const selected = fromDayKey(value);
    if (!Number.isNaN(selected.getTime())) {
      const next = startOfMonth(selected);
      if (next.getTime() !== cursor.getTime()) setCursor(next);
    }
  }

  const weeks = useMemo(
    () => monthGridKeys(cursor.getFullYear(), cursor.getMonth(), weekStartsOn),
    [cursor, weekStartsOn],
  );
  const initials = useMemo(() => weekdayInitials(weekStartsOn), [weekStartsOn]);

  const monthStart = dayKey(cursor);
  const maxMonthStart = (() => {
    const max = fromDayKey(maxKey);
    return Number.isNaN(max.getTime()) ? maxKey : dayKey(startOfMonth(max));
  })();
  const canGoNext = monthStart < maxMonthStart;

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.header}>
        <NavButton
          direction="previous"
          disabled={false}
          label="Previous month"
          onPress={() => setCursor((c) => addMonths(c, -1))}
        />
        <Text variant="headline" align="center" numberOfLines={1} style={styles.monthLabel}>
          {formatMonthYear(cursor)}
        </Text>
        <NavButton
          direction="next"
          disabled={!canGoNext}
          label="Next month"
          onPress={() => setCursor((c) => addMonths(c, 1))}
        />
      </View>

      <View style={styles.weekRow}>
        {initials.map((initial, index) => (
          <Text key={`${initial}-${index}`} variant="axisLabel" tone="faint" align="center">
            {initial}
          </Text>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={`week-${weekIndex}`} style={styles.week}>
          {week.map((key) => {
            const date = fromDayKey(key);
            const inMonth = dayKey(startOfMonth(date)) === monthStart;
            const selected = key === value;
            const future = key > maxKey;
            const isCurrentDay = isToday(date);

            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: future }}
                accessibilityLabel={describeDay(date, selected, isCurrentDay, future)}
                disabled={future}
                onPress={() => {
                  if (future) return;
                  haptics.selection();
                  onChange(key);
                }}
                style={styles.cell}
              >
                <View
                  style={[
                    styles.plate,
                    {
                      backgroundColor: selected ? colors.accent : 'transparent',
                      borderColor: isCurrentDay && !selected ? colors.accent : 'transparent',
                      borderWidth: isCurrentDay && !selected ? 1.5 : 0,
                      opacity: future ? 0.28 : inMonth || selected ? 1 : 0.45,
                    },
                  ]}
                >
                  <Text
                    variant="numericSmall"
                    align="center"
                    style={{
                      color: selected ? colors.onAccent : inMonth ? colors.text : colors.textFaint,
                    }}
                  >
                    {date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function describeDay(date: Date, selected: boolean, today: boolean, future: boolean): string {
  const base = date.toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const suffix = selected ? '. Selected' : today ? '. Today' : '';
  return future ? `${base}. Not available yet` : `${base}${suffix}`;
}

function NavButton({
  direction,
  disabled,
  label,
  onPress,
}: {
  direction: 'previous' | 'next';
  disabled: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [
        styles.nav,
        {
          backgroundColor: pressed && !disabled ? colors.surfaceSunken : 'transparent',
          opacity: disabled ? 0.3 : 1,
        },
      ]}
    >
      <Icon
        name={direction === 'previous' ? 'chevron-left' : 'chevron-right'}
        size={20}
        color={colors.text}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: space.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space.sm,
  },
  monthLabel: { flex: 1 },
  nav: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  weekRow: { flexDirection: 'row', marginBottom: space.xs },
  week: { flexDirection: 'row' },
  cell: { flex: 1, height: CELL, alignItems: 'center', justifyContent: 'center' },
  plate: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
});

export const DATE_PICKER_ROWS = ROWS;