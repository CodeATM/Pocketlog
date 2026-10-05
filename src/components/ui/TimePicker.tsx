import { useEffect, useMemo, useRef } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import { normaliseMinutes } from '@/utils/time';

import { Text } from './Text';

type Props = {
  /** Minutes since midnight. */
  value: number;
  onChange: (minutes: number) => void;
  /** Rounding step for the minute column. */
  step?: number;
  /** First selectable minute of the day. */
  minMinutes?: number;
  /** Last selectable minute of the day, inclusive. */
  maxMinutes?: number;
};

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const WHEEL_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;
/** Room for the centre band, drawn behind the numerals. */
const WHEEL_PADDING = (WHEEL_HEIGHT - ITEM_HEIGHT) / 2;

const HOURS = Array.from({ length: 24 }, (_, index) => index);

/**
 * Inline time picker: an hour column and a minute column that snap to their items.
 *
 * Replaces `DateTimePicker`, whose Android dialog drops the user out of the sheet
 * entirely. Both columns are the same control with different data, so the hours and
 * minutes line up on one shared centre band.
 *
 * The minute column is on a five-minute step by default, which is the granularity
 * anyone actually logs at; the scrubbable `DurationPicker` covers finer work.
 *
 * ```tsx
 * <TimePicker value={minutesSinceMidnight} onChange={setMinutes} />
 * ```
 */
export function TimePicker({
  value,
  onChange,
  step = 5,
  minMinutes = 0,
  maxMinutes = 24 * 60 - 1,
}: Props) {
  const { colors } = useTheme();

  const hour = Math.floor(value / 60);
  const minute = value % 60;

  const minutes = useMemo(() => {
    const first = Math.ceil(minMinutes / step) * step;
    const out: number[] = [];
    for (let m = first; m <= maxMinutes; m += step) out.push(m);
    return out.length > 0 ? out : [0];
  }, [maxMinutes, minMinutes, step]);

  const hourItems = useMemo(() => {
    const latestHour = Math.floor(maxMinutes / 60);
    const allowed = HOURS.filter((h) => h * 60 >= minMinutes && h <= latestHour);
    return allowed.length > 0 ? allowed : [Math.floor(minMinutes / 60)];
  }, [maxMinutes, minMinutes]);

  const commit = (nextHour: number, nextMinute: number) => {
    const combined = normaliseMinutes(nextHour * 60 + nextMinute, minMinutes, maxMinutes);
    if (combined === value) return;
    haptics.selection();
    onChange(combined);
  };

  const minuteIndex = useMemo(() => {
    let best = 0;
    let bestDelta = Math.abs((minutes[0] ?? 0) - minute);
    for (let index = 1; index < minutes.length; index += 1) {
      const candidate = minutes[index];
      if (candidate === undefined) continue;
      const delta = Math.abs(candidate - minute);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = index;
      }
    }
    return best;
  }, [minute, minutes]);

  return (
    <View style={[styles.container, { borderColor: colors.border }]}>
      <View style={styles.band} pointerEvents="none">
        <View style={[styles.bandFill, { backgroundColor: colors.accentSoft }]} />
      </View>

      <Column
        items={hourItems}
        selected={hourItems.indexOf(hour) === -1 ? 0 : hourItems.indexOf(hour)}
        format={(h) => String(h).padStart(2, '0')}
        accessibilityLabel="Hour"
        onSelect={(h) => commit(h, minute)}
      />

      <Text variant="headline" tone="faint" align="center" style={styles.separator}>
        :
      </Text>

      <Column
        items={minutes}
        selected={minuteIndex}
        format={(m) => String(m).padStart(2, '0')}
        accessibilityLabel="Minute"
        onSelect={(m) => commit(hour, m)}
      />
    </View>
  );
}

type ColumnProps = {
  items: readonly number[];
  selected: number;
  format: (item: number) => string;
  accessibilityLabel: string;
  onSelect: (item: number) => void;
};

function Column({ items, selected, format, accessibilityLabel, onSelect }: ColumnProps) {
  const ref = useRef<ScrollView>(null);

  // Keep the wheel in step when the value is changed from outside — tapping an hour
  // rewrites the minutes, which must not leave the minute wheel showing a stale row.
  useEffect(() => {
    ref.current?.scrollTo({ y: selected * ITEM_HEIGHT, animated: true });
  }, [selected]);

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.y / ITEM_HEIGHT);
    const clamped = Math.min(items.length - 1, Math.max(0, index));
    const item = items[clamped];
    if (item !== undefined) onSelect(item);
  };

  return (
    <ScrollView
      ref={ref}
      style={[styles.column, { height: WHEEL_HEIGHT }]}
      contentContainerStyle={{ paddingVertical: WHEEL_PADDING }}
      showsVerticalScrollIndicator={false}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      nestedScrollEnabled
      accessibilityLabel={accessibilityLabel}
      onMomentumScrollEnd={settle}
      onScrollEndDrag={settle}
    >
      {items.map((item, index) => {
        const active = index === selected;
        return (
          <Pressable
            key={item}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${accessibilityLabel} ${format(item)}`}
            onPress={() => {
              ref.current?.scrollTo({ y: index * ITEM_HEIGHT, animated: true });
              onSelect(item);
            }}
            style={styles.item}
          >
            <Text
              variant={active ? 'numericLarge' : 'body'}
              tone={active ? 'primary' : 'faint'}
              align="center"
              numberOfLines={1}
            >
              {format(item)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  column: { flex: 1 },
  item: { height: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  separator: { paddingHorizontal: space.sm },
  band: {
    position: 'absolute',
    left: space.md,
    right: space.md,
    top: WHEEL_PADDING,
    height: ITEM_HEIGHT,
    justifyContent: 'center',
  },
  bandFill: { height: '100%', borderRadius: radius.md },
});