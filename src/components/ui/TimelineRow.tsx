import { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  FadeIn,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { useTheme } from '@/theme/context';
import { motion, radius, space, type CategoryPalette } from '@/theme/tokens';
import {
  addMinutes,
  formatDuration,
  formatTime,
  spokenActivity,
  spokenDuration,
} from '@/utils/time';

import { CategoryPill } from './Chip';
import { Icon } from './Icon';
import { Text } from './Text';

export type TimelineItem = {
  id: string;
  title: string;
  categoryName: string;
  glyph: string;
  palette: CategoryPalette;
  startedAt: Date;
  durationMinutes: number;
  notes: string | null;
  /** Connector down to the next row. */
  isLast: boolean;
  /** Connector up from the previous row. */
  isFirst: boolean;
};

type Props = {
  item: TimelineItem;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Briefly tints the row: right after an optimistic insert or an undo. */
  highlighted?: boolean;
  /** Clock labels are hidden on the compact calendar panel. */
  showTimes?: boolean;
  /**
   * Longest block the duration bar is drawn against, so one day's bars are
   * comparable with each other. Defaults to two hours, which keeps the bar
   * meaningful on screens that mix entries from several days.
   */
  scaleMaxMinutes?: number;
};

const DELETE_THRESHOLD = 84;
const EDIT_THRESHOLD = 64;
const ACTION_WIDTH = 88;

/** Width of the category spine on the card's leading edge. */
const SPINE = 4;
/** The hairline thread that runs down the day through the gaps between cards. */
const THREAD = 2;
/** Thread inset so it sits centred under the spine it hangs from. */
const THREAD_X = SPINE / 2 - THREAD / 2;
/** A five-minute errand still has to leave a mark. */
const BAR_MIN = 0.05;

/**
 * Height of the thread running between two cards.
 *
 * The connector is a real flow child that *is* the spacing between rows, so a list
 * must not add a gap of its own or the cards drift twice as far apart. Keeping the
 * measurement here rather than in each list means the line can never be drawn at a
 * different size to the space it occupies.
 *
 * Drawn in flow rather than absolutely over the gap: an absolutely positioned
 * connector has to be anchored outside its parent's box, and both the percentage
 * and negative-offset forms collapsed to zero height against a content-sized parent.
 */
export const TIMELINE_GAP = space.lg;

/**
 * One activity in the timeline.
 *
 * Each entry is a card rather than a band between two hairlines. The earlier
 * version drew rules directly on the page background, which left a day looking
 * like a wireframe: nothing had a surface, so nothing had a front. A card gives
 * every entry an edge and a place to sit.
 *
 * **Three signals, in order of how fast the eye reads them.**
 *
 * - A **category spine** down the leading edge, in the category's solid colour.
 *   Scanning a day becomes a scan for colour rather than a read.
 * - A **duration bar** whose width is proportional to the longest block on the
 *   screen. The shape of the day is legible before a single number is parsed,
 *   which is the one thing a purely typographic list cannot do.
 * - The **title**, set largest, because it is what the row is actually for.
 *
 * **Rhythm.** The bar replaces the old height-from-duration trick. Varying row
 * height made the column ragged and the rows harder to scan; a fixed card with a
 * proportional bar says the same thing without the jitter.
 *
 * **Thread.** A hairline runs down the spine through the gaps, broken at the top
 * and bottom of the list. It is the one remnant of the printed-logbook idea, and
 * it costs almost nothing.
 *
 * **Swipe.** Left past the threshold deletes; right reveals edit. Both snap back
 * under the threshold. Delete never shows a dialog — it fires an undo snackbar, so
 * the row does not vanish on its own and the mistake is one tap to reverse. The
 * revealed affordances are labelled zones rather than floating icons, which keeps
 * the intent legible to anyone who cannot rely on the colour alone.
 *
 * Memoised, with no inline style objects: this is the row that renders 50+ times
 * on a heavy day and must not re-render because a sibling changed.
 *
 * ```tsx
 * <TimelineRow item={item} onPress={open} onEdit={edit} onDelete={del} />
 * ```
 */
export const TimelineRow = memo(function TimelineRow({
  item,
  onPress,
  onEdit,
  onDelete,
  highlighted = false,
  showTimes = true,
  scaleMaxMinutes = 120,
}: Props) {
  const { colors, reduceMotion } = useTheme();
  const translateX = useSharedValue(0);

  const settle = () => {
    'worklet';
    translateX.value = withSpring(0, motion.spring);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      'worklet';
      const raw = event.translationX;
      // Resistance past the action width: the row should feel like it has mass
      // rather than running off under the finger.
      translateX.value =
        raw > 0 ? Math.min(ACTION_WIDTH, raw * 0.3) : -Math.min(ACTION_WIDTH * 2.6, -raw * 0.85);
    })
    .onEnd((event) => {
      'worklet';
      if (translateX.value <= -DELETE_THRESHOLD) {
        runOnJS(onDelete)();
      } else if (translateX.value >= EDIT_THRESHOLD) {
        runOnJS(onEdit)();
      } else if (Math.abs(event.velocityX) > 850) {
        if (event.velocityX < 0) runOnJS(onDelete)();
        else runOnJS(onEdit)();
      }
      settle();
    });

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const deleteRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-ACTION_WIDTH * 2, -DELETE_THRESHOLD, -16], [1, 0.85, 0], 'clamp'),
  }));

  const editRevealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [16, EDIT_THRESHOLD, ACTION_WIDTH], [0, 0.85, 1], 'clamp'),
  }));

  const endedAt = addMinutes(item.startedAt, item.durationMinutes);
  const fill = Math.max(BAR_MIN, Math.min(1, item.durationMinutes / Math.max(1, scaleMaxMinutes)));

  return (
    <Animated.View
      style={styles.shell}
      entering={highlighted && !reduceMotion ? FadeIn.duration(200) : undefined}
    >
{!item.isFirst ? (
        <View style={[styles.thread, { backgroundColor: colors.border }]} />
      ) : null}
      {!item.isLast ? (
        <View style={[styles.thread, { backgroundColor: colors.border }]} />
      ) : null}

      <Animated.View
        style={[styles.action, styles.actionEnd, { backgroundColor: colors.dangerSoft }, deleteRevealStyle]}
      >
        <Icon name="trash" size={20} color={colors.danger} />
        <Text variant="caption" tone="danger">
          Delete
        </Text>
      </Animated.View>

      <Animated.View
        style={[styles.action, styles.actionStart, { backgroundColor: colors.accentSoft }, editRevealStyle]}
      >
        <Icon name="edit" size={20} color={colors.accent} />
        <Text variant="caption" tone="accent">
          Edit
        </Text>
      </Animated.View>

      <GestureDetector gesture={pan}>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: highlighted ? item.palette.tint : colors.surface,
              borderColor: colors.border,
            },
            rowStyle,
          ]}
        >
          <View style={[styles.spine, { backgroundColor: item.palette.solid }]} />

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={spokenActivity({
              title: item.title,
              categoryName: item.categoryName,
              startedAt: item.startedAt,
              durationMinutes: item.durationMinutes,
            })}
            accessibilityHint={
              item.notes
                ? `Has a note. ${spokenDuration(item.durationMinutes)}.`
                : 'Double tap to open. Swipe left to delete, right to edit.'
            }
            onPress={onPress}
            style={styles.pressable}
          >
            <View style={styles.topLine}>
              {showTimes ? (
                <Text variant="numericSmall" tone="muted" numberOfLines={1}>
                  {`${formatTime(item.startedAt)} – ${formatTime(endedAt)}`}
                </Text>
              ) : null}
              <Text variant="numericSmall" numberOfLines={1}>
                {formatDuration(item.durationMinutes)}
              </Text>
            </View>

            <Text variant="headline" numberOfLines={2}>
              {item.title}
            </Text>

            <View style={[styles.barTrack, { backgroundColor: colors.surfaceSunken }]}>
              <View
                style={[styles.barFill, { width: `${fill * 100}%`, backgroundColor: item.palette.solid }]}
              />
            </View>

            <View style={styles.meta}>
              <CategoryPill label={item.categoryName} glyph={item.glyph} palette={item.palette} compact />
              {item.notes ? <Icon name="file" size={13} color={colors.textFaint} /> : null}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
});

/**
 * Quiet spacer for unlogged time between two activities.
 *
 * Gaps are part of the story a day log tells, but they are not what the user came
 * to read, so the thread simply continues through them with the length set
 * quietly beside it. Under ten minutes it renders nothing at all, because a
 * two-minute gap is noise rather than information.
 *
 * ```tsx
 * <TimelineGap minutes={gapMinutes} first={index === 0} last={isLast} />
 * ```
 */
export const TimelineGap = memo(function TimelineGap({
  minutes,
  first = false,
  last = false,
}: {
  minutes: number;
  first?: boolean;
  last?: boolean;
}) {
  const { colors } = useTheme();
  if (minutes < 10) return null;

  return (
    <View
      style={styles.gap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[styles.gapThread, { backgroundColor: colors.border, opacity: first ? 0 : 1 }]}
      />
      <Text variant="numericSmall" tone="faint" style={styles.gapLabel}>
        {formatDuration(minutes)}
      </Text>
      <View
        style={[styles.gapThread, { backgroundColor: colors.border, opacity: last ? 0 : 1 }]}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  // A column so the connector above and below the card can hold their own height.
  shell: { flexDirection: 'column' },

  thread: {
    width: THREAD,
    height: TIMELINE_GAP,
    marginLeft: THREAD_X,
    borderRadius: THREAD,
  },

  card: {
    flexDirection: 'row',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  spine: { width: SPINE },
  pressable: {
    flex: 1,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    gap: space.sm,
  },
  topLine: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  barTrack: { height: 5, borderRadius: radius.pill, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },

  action: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: radius.md,
  },
  actionStart: { left: 0 },
  actionEnd: { right: 0 },

  gap: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingLeft: space.md },
  gapThread: { width: THREAD, height: 22, borderRadius: THREAD },
  gapLabel: { letterSpacing: 0 },
});