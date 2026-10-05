import { useEffect, useMemo } from 'react';
import { Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';

type Props = {
  width?: number | `${number}%`;
  height?: number;
  /** Rounded pill by default; pass a radius for a block placeholder. */
  rounded?: boolean;
  style?: ViewStyle;
};

/**
 * Loading placeholder.
 *
 * A single low-contrast pulse rather than a staggered shimmer: on a warm neutral
 * palette a travelling highlight reads as a glitch, whereas a slow breath reads
 * as "still thinking". Stops entirely under reduced motion and simply holds its
 * resting tone.
 *
 * ```tsx
 * <Skeleton height={56} />
 * <Skeleton width={220} height={14} />
 * ```
 */
export function Skeleton({ width = '100%', height = 16, rounded = true, style }: Props) {
  const { colors, reduceMotion } = useTheme();
  // One animated value per component instance. `useMemo` rather than
  // `useRef(...).current` because the value is needed during render and reading a
  // ref there is exactly the pattern the compiler lint rule rejects.
  const pulse = useMemo(() => new Animated.Value(0), []);
  const animatedOpacity = useMemo(
    () => pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
    [pulse],
  );

  useEffect(() => {
    if (reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse, reduceMotion]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        {
          width,
          height,
          borderRadius: rounded ? radius.sm : 0,
          backgroundColor: colors.surfaceSunken,
          opacity: animatedOpacity,
        },
        style,
      ]}
    />
  );
}

/** A skeleton shaped like one timeline row, used by the home screen. */
export function SkeletonTimeline({ rows = 4 }: { rows?: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.timeline} accessibilityLabel="Loading your activities">
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.timelineRow}>
          <Skeleton width={44} height={12} />
          <View style={[styles.timelineRail, { backgroundColor: colors.border }]} />
          <View style={styles.timelineBody}>
            <Skeleton width={`${58 + ((index * 13) % 30)}%`} height={15} />
            <Skeleton width={72} height={11} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  timeline: { gap: space.lg, paddingTop: space.sm },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  timelineRail: { width: 1, height: 44, marginHorizontal: space.sm },
  timelineBody: { flex: 1, gap: space.sm },
});