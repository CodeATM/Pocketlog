import { useCallback, useEffect, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { radius, space, type TextTone } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  icon?: IconName;
};

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stretches to the available width; otherwise each segment sizes to its label. */
  block?: boolean;
  tone?: TextTone;
  accessibilityLabel?: string;
};

/**
 * Two-to-three way selector with a sliding indicator.
 *
 * One absolutely positioned surface translates to the measured segment width, so
 * the movement reads as a single object sliding rather than two views fading. A
 * short ease-out is used instead of a spring: this is a control that gets tapped
 * often, and a bounce on every switch would be noise. Reduced motion pins the
 * indicator to its target with zero duration.
 *
 * ```tsx
 * <SegmentedControl options={RANGE_OPTIONS} value={range} onChange={setRange} block />
 * ```
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  block = false,
  tone = 'primary',
  accessibilityLabel,
}: Props<T>) {
  const { colors, reduceMotion } = useTheme();
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const translateX = useSharedValue(0);

  const index = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );
  const segmentWidth = measuredWidth > 0 ? (measuredWidth - 6) / options.length : 0;
  const target = index * segmentWidth;

  useEffect(() => {
    translateX.value = withTiming(target, { duration: reduceMotion ? 0 : 200 });
  }, [translateX, target, reduceMotion]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    width: segmentWidth,
  }));

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setMeasuredWidth(event.nativeEvent.layout.width);
  }, []);

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      onLayout={onLayout}
      style={[
        styles.container,
        block ? styles.block : null,
        { backgroundColor: colors.surfaceSunken, borderColor: colors.border },
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
            indicatorStyle,
          ]}
        />
      ) : null}

      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (option.value === value) return;
              haptics.selection();
              onChange(option.value);
            }}
            style={styles.segment}
          >
            <View style={styles.segmentInner}>
              {option.icon ? (
                <Icon
                  name={option.icon}
                  size={15}
                  color={selected ? colors.accent : colors.textMuted}
                  strokeWidth={selected ? 2 : 1.75}
                />
              ) : null}
              <Text variant="callout" tone={selected ? tone : 'muted'} numberOfLines={1}>
                {option.label}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    // A hard stop. The segments below are allowed to shrink, but if a label still
    // cannot fit the row clips instead of spilling past the card's edge.
    overflow: 'hidden',
    // Lets the control give up width inside a `ListRow` trailing slot rather than
    // forcing the row wider than its container.
    flexShrink: 1,
  },
  block: { alignSelf: 'stretch' },
  indicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segment: {
    flex: 1,
    // Must be 0, not a positive minimum: Yoga floors a flex child at its min width,
    // so any floor here is subtracted from the space the control is given and the
    // overflow lands outside the card. The indicator below assumes equal widths,
    // which `flex: 1` with no floor guarantees.
    minWidth: 0,
    minHeight: 38,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
  segmentInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
    // Lets the label ellipsize instead of pushing the row wide.
    flexShrink: 1,
  },
});