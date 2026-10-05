import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { space } from '@/theme/tokens';
import type { CategoryPalette } from '@/theme/tokens';
import { shareOfDay, spokenCount, spokenDuration } from '@/utils/time';

import { CountUpMinutes, CountUpNumber } from './CountUp';
import { DaySegmentBar } from './ProgressBar';
import { Text } from './Text';

export type SummarySegment = { id: string; minutes: number; palette: CategoryPalette };

type Props = {
  minutes: number;
  count: number;
  segments: SummarySegment[];
  /** 0–1 of the waking day considered "full"; drives the quiet caption. */
  goalMinutes?: number;
};

/**
 * The strip under the home header: total time, entry count, and the shape of the
 * day.
 *
 * The big numeral is the single focal point of the screen — everything else in
 * the strip exists to qualify it. The segmented bar is a printed rule rather than
 * a chart: it answers "how was the day split" in eight pixels of height, and the
 * full breakdown lives on the Insights tab where there is room for it.
 *
 * Numbers count up once on mount (see `CountUpMinutes`); later changes snap.
 *
 * ```tsx
 * <SummaryStrip minutes={315} count={7} segments={segments} goalMinutes={480} />
 * ```
 */
export function SummaryStrip({ minutes, count, segments, goalMinutes = 8 * 60 }: Props) {
  const { colors } = useTheme();

  const barSegments = useMemo(
    () =>
      segments
        .filter((segment) => segment.minutes > 0)
        .map((segment) => ({
          id: segment.id,
          share: segment.minutes,
          color: segment.palette.solid,
        })),
    [segments],
  );

  const share = shareOfDay(minutes / goalMinutes);
  const caption = shareOfDay(minutes) >= 0.75 ? 'A full day' : share >= 0.4 ? 'Half a day, give or take' : 'A light day so far';

  return (
    <View
      style={[styles.container, { borderTopColor: colors.border, borderBottomColor: colors.border }]}
      accessible={false}
    >
      <View style={styles.figures}>
        <CountUpMinutes
          minutes={minutes}
          accessibilityLabel={`${spokenDuration(minutes)} logged today, ${spokenCount(count, 'activity', 'activities')}`}
        />
        <View style={styles.caption}>
          <Text variant="callout" tone="muted">
            logged today
          </Text>
        </View>
      </View>

      <View style={styles.countColumn}>
        <CountUpNumber value={count} variant="numericSmall" tone="primary" animate={false} />
        <Text variant="caption" tone="faint" numberOfLines={2}>
          {count === 1 ? 'activity' : 'activities'}
        </Text>
      </View>

      <View style={styles.barArea}>
        <DaySegmentBar segments={barSegments} height={8} />
        <Text variant="caption" tone="faint" style={styles.barCaption}>
          {barSegments.length === 0 ? 'Nothing recorded yet' : `${barSegments.length} ${barSegments.length === 1 ? 'category' : 'categories'} · ${caption}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: space.lg,
    gap: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  figures: { flexDirection: 'row', alignItems: 'flex-end', gap: space.md },
  caption: { paddingBottom: space.sm },
  countColumn: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  barArea: { gap: space.sm },
  barCaption: { letterSpacing: 0 },
});