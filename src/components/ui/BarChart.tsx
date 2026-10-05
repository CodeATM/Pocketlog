import { memo, useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedProps,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Line, Rect } from 'react-native-svg';

import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import { formatDuration, spokenDuration } from '@/utils/time';

import { Text } from './Text';

const AnimatedRect = Animated.createAnimatedComponent(Rect);

export type Stack = {
  /** Category id — stable React key and the basis for the stacked order. */
  id: string;
  /** Human label, shown in the tooltip. */
  name: string;
  color: string;
  minutes: number;
};

export type BarDatum = {
  /** Stable identity: a day key, or `YYYY-MM-01` for a month heat column. */
  key: string;
  /** Terse axis label. */
  label: string;
  /** Full label for the tooltip and accessibility. */
  fullLabel: string;
  stacks: Stack[];
  totalMinutes: number;
  /** Marks today, or the final column of the range. */
  isCurrent?: boolean;
};

type Props = {
  data: BarDatum[];
  onSelect?: (datum: BarDatum | null) => void;
  selectedKey?: string | null;
  height?: number;
  showAxis?: boolean;
  /** Height reserved under the baseline for the axis labels. */
  axisHeight?: number;
};

const COLUMN_GROW_MS = 460;

/**
 * Stacked column chart, drawn directly with `react-native-svg`.
 *
 * Written by hand rather than configured out of a charting library for three
 * reasons the brief cares about: it is a little over a hundred lines, it produces
 * none of a library's legend or gridline chrome, and it stacks by exactly one
 * dimension — category colour — which a general-purpose chart needs twenty
 * configuration lines to arrive at.
 *
 * Columns grow from the baseline on mount and on every range change, because a
 * chart that snaps into place reads as a table. The growth is a Reanimated
 * `useAnimatedProps` on SVG rects, so it runs on the UI thread and cannot block a
 * touch mid-animation. Reduced motion renders final heights immediately.
 *
 * Touch targets are the full column slot, not the drawn rect: a four-hour column
 * and a ten-minute one would otherwise be wildly different tap targets.
 *
 * ```tsx
 * <BarChart data={bars} selectedKey={selected} onSelect={setSelected} />
 * ```
 */
export const BarChart = memo(function BarChart({
  data,
  onSelect,
  selectedKey = null,
  height = 168,
  showAxis = true,
  axisHeight = 26,
}: Props) {
  const { colors, reduceMotion } = useTheme();

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    // A floor of 60 minutes keeps a nearly empty week from rendering as
    // invisible slivers against a mathematically exact maximum.
    const maxTotal = Math.max(60, ...data.map((datum) => datum.totalMinutes));
    const slot = 1 / data.length;
    const usable = height - (showAxis ? axisHeight : 0);

    return data.map((datum, index) => {
      const stack = [...datum.stacks]
        .filter((item) => item.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes);

      let cursor = usable;
      const segments = stack.map((item) => {
        const segmentHeight = (item.minutes / maxTotal) * usable;
        const y = cursor - segmentHeight;
        cursor = y;
        return { id: item.id, color: item.color, y, height: Math.max(1.5, segmentHeight) };
      });

      return {
        datum,
        slotStart: index * slot,
        slotWidth: slot,
        fullHeight: (datum.totalMinutes / maxTotal) * usable,
        segments,
      };
    });
  }, [data, height, showAxis, axisHeight]);

  const baseline = height - (showAxis ? axisHeight : 0);

  return (
    <View style={styles.container}>
      <View style={[styles.canvas, { height }]} accessible={false}>
        <Svg width="100%" height={height}>
          <Line
            x1={0}
            y1={baseline}
            x2="100%"
            y2={baseline}
            stroke={colors.border}
            strokeWidth={StyleSheet.hairlineWidth * 2}
          />

          {columns.map((column, index) => (
            <Column
              key={column.datum.key}
              slotWidth={column.slotWidth}
              segments={column.segments}
              fullHeight={column.fullHeight}
              selected={selectedKey === column.datum.key}
              dimmed={selectedKey !== null && selectedKey !== column.datum.key}
              trackColor={colors.surfaceSunken}
              reduceMotion={reduceMotion}
              delay={index * 26}
            />
          ))}
        </Svg>

        {columns.map((column) => {
          const selected = selectedKey === column.datum.key;
          return (
            <Pressable
              key={column.datum.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${column.datum.fullLabel}, ${spokenDuration(column.datum.totalMinutes)}`}
              accessibilityHint={onSelect ? 'Double tap to show the breakdown.' : undefined}
              onPress={onSelect ? () => onSelect(selected ? null : column.datum) : undefined}
              style={[styles.hitSlot, { left: `${column.slotStart * 100}%`, width: `${column.slotWidth * 100}%` }]}
            />
          );
        })}
      </View>

      {showAxis ? (
        <View style={styles.axis}>
          {data.map((datum) => (
            <Text
              key={datum.key}
              variant="caption"
              tone={selectedKey === datum.key ? 'accent' : datum.isCurrent ? 'primary' : 'faint'}
              align="center"
              numberOfLines={1}
            >
              {datum.label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
});

type ColumnProps = {
  slotWidth: number;
  segments: { id: string; color: string; y: number; height: number }[];
  fullHeight: number;
  selected: boolean;
  dimmed: boolean;
  trackColor: string;
  reduceMotion: boolean;
  delay: number;
};

const Column = memo(function Column({
  slotWidth,
  segments,
  fullHeight,
  selected,
  dimmed,
  trackColor,
  reduceMotion,
  delay,
}: ColumnProps) {
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.value = reduceMotion
      ? 1
      : withDelay(delay, withTiming(1, { duration: COLUMN_GROW_MS }));
  }, [progress, delay, reduceMotion]);

  // Bar width is a fraction of the slot, so a seven-day week and a thirty-day
  // month both stay legible.
  const widthRatio = 0.56;
  const corner = Math.min(6, slotWidth * 24);

  const trackProps = useAnimatedProps(() => ({
    height: fullHeight * progress.value,
    y: fullHeight * (1 - progress.value),
  }));

  return (
    <>
      <AnimatedRect
        x={slotWidth * (0.5 - widthRatio / 2)}
        y={0}
        width={slotWidth * widthRatio}
        rx={corner}
        fill={trackColor}
        opacity={dimmed ? 0.45 : 1}
        animatedProps={trackProps}
      />

      {segments.map((segment) => (
        <Segment
          key={segment.id}
          progress={progress}
          x={slotWidth * (0.5 - widthRatio / 2) + (selected ? -1.5 : 0)}
          width={slotWidth * widthRatio + (selected ? 3 : 0)}
          y={segment.y}
          height={segment.height}
          color={segment.color}
          opacity={dimmed ? 0.45 : 1}
          selected={selected}
        />
      ))}
    </>
  );
});

function Segment({
  progress,
  x,
  width,
  y,
  height,
  color,
  opacity,
  selected,
}: {
  progress: SharedValue<number>;
  x: number;
  width: number;
  y: number;
  height: number;
  color: string;
  opacity: number;
  selected: boolean;
}) {
  const animatedProps = useAnimatedProps(() => {
    const grown = height * progress.value;
    return {
      height: Math.max(0, grown),
      // Anchored to the bottom of the segment so the stack grows upward from the
      // baseline rather than sliding as one block.
      y: y + height - grown,
    };
  });

  return (
    <AnimatedRect
      x={x}
      y={y}
      width={width}
      height={height}
      rx={selected ? 4 : 2}
      fill={color}
      opacity={opacity}
      animatedProps={animatedProps}
    />
  );
}

/**
 * Detail for the selected column, rendered beneath the chart.
 *
 * Keeping the tooltip in flow rather than floating means it can never cover the
 * bars it explains, and on a small screen it simply pushes the rest of the page
 * down by its own height instead of overlapping it.
 */
export function BarTooltip({ datum }: { datum: BarDatum }) {
  const { colors } = useTheme();
  const rows = useMemo(
    () => [...datum.stacks].filter((stack) => stack.minutes > 0).sort((a, b) => b.minutes - a.minutes),
    [datum],
  );

  return (
    <View
      style={[styles.tooltip, { borderTopColor: colors.border }]}
      accessible
      accessibilityLabel={`${datum.fullLabel}, ${spokenDuration(datum.totalMinutes)} total`}
    >
      <View style={styles.tooltipHead}>
        <Text variant="headline" numberOfLines={1} style={styles.tooltipTitle}>
          {datum.fullLabel}
        </Text>
        <Text variant="numericSmall" tone="accent">
          {formatDuration(datum.totalMinutes)}
        </Text>
      </View>

      <View style={styles.tooltipRows}>
        {rows.map((stack) => (
          <View key={stack.id} style={styles.tooltipRow}>
            <View style={[styles.swatch, { backgroundColor: stack.color }]} />
            <Text variant="caption" tone="muted" numberOfLines={1} style={styles.tooltipLabel}>
              {stack.name}
            </Text>
            <Text variant="numericSmall" tone="muted">
              {formatDuration(stack.minutes)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', gap: space.xs },
  canvas: { width: '100%', position: 'relative' },
  hitSlot: { position: 'absolute', top: 0, bottom: 0 },
  axis: { flexDirection: 'row' },
  tooltip: {
    gap: space.md,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  tooltipHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.md },
  tooltipTitle: { flex: 1 },
  tooltipRows: { gap: space.xs },
  tooltipRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  swatch: { width: 8, height: 8, borderRadius: radius.pill },
  tooltipLabel: { flex: 1, letterSpacing: 0 },
});