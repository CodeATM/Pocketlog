import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { useTheme } from '@/theme/context';
import { radius } from '@/theme/tokens';

type Props = {
  /** 0–1. Values outside are clamped rather than throwing. */
  value: number;
  height?: number;
  tone?: 'accent' | 'muted';
  style?: StyleProp<ViewStyle>;
};

/**
 * Thin determinate track.
 *
 * Used for the "day fullness" hint on the home summary. Deliberately not
 * animated: it is a readout of a number, and a bar that slides after the fact
 * would report a value the user did not ask about.
 *
 * ```tsx
 * <ProgressBar value={minutes / 480} />
 * ```
 */
export function ProgressBar({ value, height = 3, tone = 'accent', style }: Props) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: colors.surfaceSunken }, style]}
    >
      <View
        style={{
          width: `${clamped * 100}%`,
          height: '100%',
          borderRadius: radius.pill,
          backgroundColor: tone === 'accent' ? colors.accent : colors.textMuted,
        }}
      />
    </View>
  );
}

/**
 * Category-proportion bar.
 *
 * One hairline-tall row of segments whose widths are the share of the day spent in
 * each category. This is the app's signature chart: it replaces a legend-heavy
 * donut with something that reads as a printed rule.
 */
export function DaySegmentBar({
  segments,
  height = 8,
}: {
  segments: { id: string; share: number; color: string }[];
  height?: number;
}) {
  const { colors } = useTheme();
  const total = segments.reduce((sum, segment) => sum + segment.share, 0);

  if (total <= 0) {
    return (
      <View style={[styles.track, { height, backgroundColor: colors.surfaceSunken }]} />
    );
  }

  const summary = segments
    .filter((segment) => segment.share > 0)
    .sort((a, b) => b.share - a.share)
    .map((segment) => `${segment.id} ${Math.round((segment.share / total) * 100)}%`)
    .join(', ');

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Day breakdown: ${summary}`}
      entering={FadeIn.duration(220)}
      style={[styles.track, { height }, { gap: 2 }]}
    >
      {segments
        .filter((segment) => segment.share > 0)
        .map((segment) => (
          <View
            key={segment.id}
            style={{
              flexGrow: segment.share,
              flexBasis: 0,
              height: '100%',
              borderRadius: radius.pill,
              backgroundColor: segment.color,
            }}
          />
        ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    width: '100%',
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
});