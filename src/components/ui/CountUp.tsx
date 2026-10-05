import { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { useTheme } from '@/theme/context';
import { toneColor, type TextTone, type TypeVariant } from '@/theme/tokens';
import { formatDuration } from '@/utils/time';

import { Text } from './Text';

type Props = {
  minutes: number;
  variant?: TypeVariant;
  tone?: TextTone;
  /** Animated once on mount. Disabled automatically under reduced motion. */
  countUp?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

const DURATION_MS = 620;

/**
 * The app's hero number: total time logged, as one tabular duration.
 *
 * Counts up on mount over ~600ms with an ease-out, because the number landing is
 * what makes a log feel like it is recording something. It runs **once** — the
 * effect keys on `run` and never on the value, so a later change (an optimistic
 * insert, a pull-to-refresh) snaps straight to the new figure instead of
 * re-animating and drawing attention away from the row that just appeared.
 *
 * Reduced motion renders the final value immediately.
 *
 * ```tsx
 * <CountUpMinutes minutes={summary.minutes} />
 * ```
 */
export function CountUpMinutes({
  minutes,
  variant = 'numericLarge',
  tone = 'primary',
  countUp = true,
  accessibilityLabel,
  style,
}: Props) {
  const { reduceMotion } = useTheme();
  const target = Math.max(0, Math.round(minutes));

  // The animated value is kept in JS rather than in a shared value because the
  // text has to be re-rendered each frame anyway; a worklet would just add a
  // round-trip for no gain at 60fps for a single string.
  // Derived rather than stored: when motion is off there is nothing to animate, so
  // the target is rendered directly and the effect never runs.
  const shouldAnimate = !reduceMotion && countUp;
  const [display, setDisplay] = useState(shouldAnimate ? 0 : target);
  const frame = useRef(0);

  useEffect(() => {
    if (!shouldAnimate) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(target * eased));
      if (t < 1) {
        frame.current = requestAnimationFrame(tick);
      }
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
    // Intentionally keyed on the target only via `run`: see the note above.
  }, [target, shouldAnimate]);

  const value = shouldAnimate ? display : target;

  return (
    <View style={style}>
      <Text
        variant={variant}
        tone={tone}
        accessibilityLabel={accessibilityLabel}
        // The visible text is redundant with the label; keeping it hidden stops a
        // screen reader announcing "5h 15m" and "5 hours 15 minutes" in turn.
        accessibilityElementsHidden={accessibilityLabel ? true : undefined}
      >
        {formatDuration(value)}
      </Text>
    </View>
  );
}

/**
 * A small integer that counts up to its value.
 *
 * Used for activity counts and chart tooltips. Shares the duration curve with
 * `CountUpMinutes` so the two never disagree about tempo.
 */
export function CountUpNumber({
  value,
  variant = 'numericSmall',
  tone = 'muted',
  suffix,
  animate = false,
  style,
}: {
  value: number;
  variant?: TypeVariant;
  tone?: TextTone;
  suffix?: string;
  /** Off by default: only figures the user just caused should animate. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduceMotion } = useTheme();
  const target = Math.max(0, Math.round(value));
  const shouldAnimate = animate && !reduceMotion;
  const [display, setDisplay] = useState(shouldAnimate ? 0 : target);
  const frame = useRef(0);

  useEffect(() => {
    if (!shouldAnimate) return;

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 420);
      setDisplay(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, shouldAnimate]);

  const shown = shouldAnimate ? display : target;

  return (
    <Text variant={variant} tone={tone} style={style}>
      {`${shown}${suffix ?? ''}`}
    </Text>
  );
}

/**
 * Wraps an animated value in an opacity ramp.
 *
 * Kept separate from the counting components so any figure can opt into the same
 * entrance without owning an animation loop.
 */
export function FadeInView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { reduceMotion } = useTheme();
  const opacity = useSharedValue(reduceMotion ? 1 : 0);
  const translateY = useSharedValue(reduceMotion ? 0 : 6);

  useEffect(() => {
    opacity.value = withTiming(1, {
      duration: reduceMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
    });
    translateY.value = withTiming(0, {
      duration: reduceMotion ? 0 : 260,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, translateY, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return <Animated.View style={[styles.fade, animatedStyle, style]}>{children}</Animated.View>;
}

const styles = StyleSheet.create({
  fade: { width: '100%' },
});

/** Resolves a tone to its colour, for callers that need it outside `Text`. */
export function useToneColor(tone: TextTone): string {
  const { scheme } = useTheme();
  return useMemo(() => toneColor(tone, scheme), [tone, scheme]);
}