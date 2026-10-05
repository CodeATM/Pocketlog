import { useCallback, useMemo, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { hitSize, radius, shadows, space } from '@/theme/tokens';
import { formatDurationSpaced, snapToStep, spokenDuration, splitDuration } from '@/utils/time';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  /** Total minutes. Snapped to 5-minute steps while dragging. */
  minutes: number;
  onChange: (minutes: number) => void;
  maxMinutes?: number;
  presets?: readonly number[];
  label?: string;
};

export const DURATION_PRESETS = [15, 30, 45, 60, 120] as const;

const STEP = 5;
/** The track spans this range, so the ends are labelled rather than marked. */
const TRACK_MAX = 8 * 60;
const KNOB = 24;

function clampMinutes(value: number, maxMinutes: number): number {
  return Math.min(maxMinutes, Math.max(STEP, snapToStep(value, STEP)));
}

/**
 * Duration control.
 *
 * Three affordances, in order of likelihood: presets for the shapes people actually
 * log, a draggable track for anything in between, and a ± stepper for anyone who
 * would rather not drag at all.
 *
 * The drag uses `PanResponder` rather than a gesture-handler pan. A gesture-handler
 * pan inside the add sheet's scroll view loses the race against the native scroller,
 * so the track either scrolled the sheet or did nothing. Claiming the responder from
 * the touch's start instead — not from the first move — means the enclosing `ScrollView`
 * never begins a scroll, and the track behaves like a slider everywhere.
 *
 * Accessibility: the track is an `adjustable` element, so TalkBack and Switch
 * Control can increment and decrement directly, and the value is announced in
 * spoken form ("2 hours 20 minutes") rather than the compact visual string.
 *
 * ```tsx
 * <DurationPicker minutes={value} onChange={setValue} />
 * ```
 */
export function DurationPicker({
  minutes,
  onChange,
  maxMinutes = 12 * 60,
  presets = DURATION_PRESETS,
  label = 'Duration',
}: Props) {
  const { colors, scheme } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const clamp = useCallback((value: number) => clampMinutes(value, maxMinutes), [maxMinutes]);

  const applyFromX = useCallback(
    (x: number) => {
      if (trackWidth <= 0) return;
      const ratio = Math.min(1, Math.max(0, x / trackWidth));
      const next = clamp(ratio * TRACK_MAX);
      if (next === minutes) return;
      haptics.selection();
      onChange(next);
    },
    [clamp, minutes, onChange, trackWidth],
  );

  // The track is absolute-positioned against a measured width, so the responder has
  // to be rebuilt whenever that width changes. `applyFromX` closes over the current
  // value, which is what keeps a drag from snapping back to where it started.
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          haptics.light();
          applyFromX(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => applyFromX(event.nativeEvent.locationX),
      }),
    [applyFromX],
  );

  const nudge = useCallback(
    (delta: number) => {
      const next = clamp(minutes + delta);
      if (next === minutes) return;
      haptics.selection();
      onChange(next);
    },
    [clamp, minutes, onChange],
  );

  const onTrackLayout = useCallback((event: LayoutChangeEvent) => {
    setTrackWidth(event.nativeEvent.layout.width);
  }, []);

  const { hours, minutes: mins } = splitDuration(minutes);
  const ratio = Math.min(1, Math.max(0, minutes / TRACK_MAX));

  return (
    <View style={styles.container}>
      {presets.length > 0 ? (
        <View style={styles.presets}>
          {presets.map((preset) => {
            const selected = preset === minutes;
            return (
              <Pressable
                key={preset}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${spokenDuration(preset)} preset`}
                onPress={() => {
                  haptics.selection();
                  onChange(clamp(preset));
                }}
                style={({ pressed }) => [
                  styles.preset,
                  {
                    backgroundColor: selected ? colors.accentSoft : 'transparent',
                    borderColor: selected ? colors.accent : colors.border,
                    opacity: pressed ? 0.72 : 1,
                  },
                ]}
              >
                <Text variant="numericSmall" tone={selected ? 'accent' : 'muted'}>
                  {formatDurationSpaced(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <View style={styles.readoutRow}>
        <StepButton
          label="Decrease duration by 5 minutes"
          glyph="minus"
          onPress={() => nudge(-STEP)}
          disabled={minutes <= STEP}
        />

        <View style={styles.value}>
          <Text variant="numericLarge" align="center">
            {`${hours}h ${mins}m`}
          </Text>
        </View>

        <StepButton
          label="Increase duration by 5 minutes"
          glyph="plus"
          onPress={() => nudge(STEP)}
          disabled={minutes >= maxMinutes}
        />
      </View>

      <View style={styles.trackBlock}>
        <View
          {...responder.panHandlers}
          onLayout={onTrackLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel={label}
          accessibilityValue={{ text: spokenDuration(minutes) }}
          accessibilityActions={[
            { name: 'increment', label: 'Add 5 minutes' },
            { name: 'decrement', label: 'Subtract 5 minutes' },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === 'increment') nudge(STEP);
            if (event.nativeEvent.actionName === 'decrement') nudge(-STEP);
          }}
          style={styles.trackHit}
        >
          <View style={[styles.rail, { backgroundColor: colors.border }]}>
            <View
              style={[styles.fill, { backgroundColor: colors.accent, width: `${ratio * 100}%` }]}
            />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.knob,
              {
                backgroundColor: colors.accent,
                borderColor: colors.surfaceRaised,
                left: Math.max(0, ratio * trackWidth - KNOB / 2),
              },
              shadows.knob[scheme],
            ]}
          />
        </View>

        <View style={styles.scale}>
          <Text variant="axisLabel" tone="faint">
            0
          </Text>
          <Text variant="axisLabel" tone="faint">
            8h
          </Text>
        </View>
      </View>
    </View>
  );
}

function StepButton({
  label,
  glyph,
  onPress,
  disabled,
}: {
  label: string;
  glyph: 'minus' | 'plus';
  onPress: () => void;
  disabled: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.step,
        {
          backgroundColor: pressed && !disabled ? colors.surfaceSunken : colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.35 : 1,
        },
      ]}
    >
      <Icon name={glyph} size={20} color={disabled ? colors.textFaint : colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.lg },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  preset: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  readoutRow: { flexDirection: 'row', alignItems: 'center' },
  value: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  step: {
    width: hitSize,
    height: hitSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trackBlock: { gap: space.xs },
  // Tall enough to be a comfortable drag target; the visible rail is much thinner.
  trackHit: { height: 36, justifyContent: 'center' },
  rail: { height: 6, width: '100%', borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  knob: {
    position: 'absolute',
    width: KNOB,
    height: KNOB,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
});