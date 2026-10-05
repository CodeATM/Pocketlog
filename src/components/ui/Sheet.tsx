import { useEffect, useState, type ReactNode, type RefObject } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { reflow } from '@/lib/motion';
import { useTheme } from '@/theme/context';
import { layout, motion, radius, shadows, space } from '@/theme/tokens';

import { Text } from './Text';

type Props = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  /** Fraction of screen height, 0–1. The add/edit sheet uses 0.9. */
  heightRatio?: number;
  /** Frozen content pinned under the scroll area — the sticky Save bar. */
  footer?: ReactNode;
  scrollable?: boolean;
  handle?: boolean;
  /** Non-dismissible sheets (the clear-data confirmation) keep the user in. */
  dismissible?: boolean;
  /**
   * Handle on the content scroll view, so a consumer can bring a section into view
   * — the add sheet uses it to reveal an expanded picker that opened below the fold.
   */
  scrollRef?: RefObject<ScrollView | null>;
};

const DISMISS_FRACTION = 0.28;
const DISMISS_VELOCITY = 900;
const EXIT_MS = 200;

/**
 * Bottom sheet.
 *
 * Hand-built on gesture-handler + Reanimated rather than pulled from a library,
 * for two reasons that matter here: it has to host native date pickers, which
 * require a real `Modal`; and the drag handle has to coexist with a scroll view
 * without ever stealing its scroll. So the pan gesture is bound to the grab
 * handle and header strip only — 44pt of deliberate target — and the content area
 * scrolls untouched.
 *
 * The scrim's opacity is bound to the same progress value as the sheet's
 * translation, so a drag fades the background in step rather than cutting out.
 *
 * Reduced motion keeps the travel (the sheet still has to arrive somewhere) but
 * shortens it to an instant settle and drops the spring overshoot.
 *
 * ```tsx
 * <Sheet visible={open} onClose={close} title="New activity" heightRatio={0.9} footer={<Bar />}>
 *   <Form />
 * </Sheet>
 * ```
 */
export function Sheet({
  visible,
  onClose,
  children,
  title,
  heightRatio = 0.9,
  footer,
  scrollable = true,
  handle = true,
  dismissible = true,
  scrollRef,

}: Props) {
const { colors, scheme, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetHeight = Math.round(windowHeight * heightRatio);

  // A `Modal` gets its own window, and on Android that window does not resize for
  // the keyboard — so a full-height sheet leaves the pinned footer underneath it and
  // the user cannot reach Save after typing a title. Shrinking the panel by the
  // keyboard height brings the footer up to sit just above it.
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  /** Never collapse so far that the header and footer leave no room to scroll between. */
  const panelHeight = Math.max(Math.round(windowHeight * 0.45), sheetHeight - keyboardHeight);

  // `useSharedValue` rather than `useRef`: these are Reanimated's reactive values,
  // read inside worklets and driven by the UI thread. A plain ref would be read on
  // every frame of the drag and would not survive the compiler's ref rules.
  const translateY = useSharedValue(sheetHeight);
  const progress = useSharedValue(0);

// The component stays mounted across hides so the entry animation can be driven
  // explicitly, which means an exit has to be animated too — unmounting on the
  // `visible` flip alone made every close a hard cut.
  const [mounted, setMounted] = useState(visible);
  // Reopening promotes to mounted during render rather than in an effect: doing it
  // in an effect costs an extra commit, and the first frame of the entry animation
  // would be dropped. React supports this for a component's own state.
  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!visible || !mounted) return;
    const duration = reduceMotion ? 0 : motion.slow;
    const easing = Easing.out(Easing.cubic);
    translateY.value = sheetHeight;
    progress.value = 0;
    // Travel and fade share one duration and one curve. Driving the panel with a
    // spring while the scrim faded on a timer let the two finish at different
    // moments, which read as a stutter rather than a single movement.
    translateY.value = withTiming(0, { duration, easing });
    progress.value = withTiming(1, { duration: reduceMotion ? 90 : motion.slow });
  }, [visible, mounted, sheetHeight, translateY, progress, reduceMotion]);

  useEffect(() => {
    if (visible || !mounted) return;
    progress.value = withTiming(0, { duration: reduceMotion ? 90 : EXIT_MS });
    translateY.value = withTiming(sheetHeight, {
      duration: reduceMotion ? 90 : EXIT_MS,
      easing: Easing.in(Easing.cubic),
    });
    // Stay mounted until the travel finishes, otherwise the exit never renders.
    const timer = setTimeout(() => setMounted(false), (reduceMotion ? 90 : EXIT_MS) + 20);
    return () => clearTimeout(timer);
  }, [visible, mounted, sheetHeight, translateY, progress, reduceMotion]);

  const dismiss = () => {
    Keyboard.dismiss();
    onClose();
  };

  const drag = Gesture.Pan()
    .enabled(dismissible)
    .onUpdate((event) => {
      'worklet';
      const next = translateY.value + event.translationY;
      translateY.value = Math.max(0, next);
      progress.value = 1 - Math.min(1, translateY.value / (sheetHeight * 0.5));
    })
    .onEnd((event) => {
      'worklet';
      const past = translateY.value > sheetHeight * DISMISS_FRACTION;
      if (past || event.velocityY > DISMISS_VELOCITY) {
        // Hand off to the exit effect above, which continues the travel from
        // wherever the finger left it rather than restarting the animation.
        runOnJS(dismiss)();
      } else {
        translateY.value = withSpring(0, motion.spring);
      }
    });

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

if (!mounted) return null;

  // The `gap` lives on this inner view rather than on the scroll view's content
  // container so it can carry the layout animation. A panel inserted into the
  // content then pushes the sections below it down over 240ms instead of moving
  // them in a single frame.
  const inner = (
    <Animated.View layout={reflow(reduceMotion)} style={styles.scrollInner}>
      {children}
    </Animated.View>
  );

  const body = scrollable ? (
    <ScrollView
      ref={scrollRef}
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="interactive"
      showsVerticalScrollIndicator={false}
    >
      {inner}
    </ScrollView>
  ) : (
    <View style={styles.scrollContent}>{inner}</View>
  );

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={dismiss}
      supportedOrientations={['portrait']}
    >
      <View style={styles.root}>
        <Animated.View
          style={[styles.scrim, { backgroundColor: colors.overlay }, scrimStyle]}
          pointerEvents="auto"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={StyleSheet.absoluteFill}
            onPress={dismissible ? dismiss : undefined}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
styles.sheet,
            {
              height: panelHeight,
              // The panel is bottom-anchored, so shrinking it alone would only move
              // its top edge and leave the footer under the keyboard. Lifting it by
              // the keyboard height is what actually raises Save into reach.
              marginBottom: keyboardHeight,
              paddingBottom: Math.max(insets.bottom, layout.minBottomInset),
              backgroundColor: colors.surfaceRaised,
              borderColor: colors.border,
              ...shadows.sheet[scheme],
            },
            sheetStyle,
          ]}
        >
          <GestureDetector gesture={drag}>
            <View style={styles.grabZone}>
              {handle ? (
                <View style={[styles.handle, { backgroundColor: colors.borderStrong }]} />
              ) : null}
              {title ? (
                <Text variant="title2" style={styles.title}>
                  {title}
                </Text>
              ) : null}
            </View>
          </GestureDetector>

          {body}

          {footer ? (
            <View
              style={[
                styles.footer,
                { backgroundColor: colors.surfaceRaised, borderTopColor: colors.border },
              ]}
            >
              {footer}
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
  },
  grabZone: {
    paddingTop: space.sm + 2,
    paddingBottom: space.sm,
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  handle: { width: 36, height: 4, borderRadius: radius.pill, alignSelf: 'center' },
  title: { marginTop: space.xs },
scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xl,
  },
  scrollInner: { gap: space.xl },
  footer: {
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    paddingBottom: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: space.sm,
  },
});