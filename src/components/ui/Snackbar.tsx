import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useUiStore } from '@/stores/uiStore';
import { useTheme } from '@/theme/context';
import { radius, shadows, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type SnackbarProps = {
  message: string;
  tone?: 'neutral' | 'danger';
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
  /** Milliseconds before auto-dismiss. Undo actions get longer. */
  duration?: number;
};

/**
 * Undo snackbar.
 *
 * The app's only transient message surface, and it exists for one reason: a
 * destructive action must be reversible without a confirmation dialog. It sits
 * above the tab bar rather than at the very bottom of the window so it never
 * covers the home indicator or the navigation the user might want to undo from.
 *
 * Enter and exit are 220ms ease-out slide-ups, mirrored in both directions so the
 * layout does not jump when it leaves. `duration` is extended for undo, because a
 * deliberate swipe followed by a hunt for "Undo" would be worse than the delete.
 *
 * ```tsx
 * <Snackbar
 *   message="Deleted “Deep work”"
 *   tone="danger"
 *   actionLabel="Undo"
 *   onAction={restore}
 *   onDismiss={clear}
 *   duration={6000}
 * />
 * ```
 */
export function Snackbar({
  message,
  tone = 'neutral',
  actionLabel,
  onAction,
  onDismiss,
  duration = actionLabel ? 6000 : 3200,
}: SnackbarProps) {
  const { colors, scheme, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const danger = tone === 'danger';

  useEffect(() => {
    const timer = setTimeout(onDismiss, duration);
    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  const icon: IconName = danger ? 'trash' : 'circle-check';

  return (
    <Animated.View
      // Announced as a live region so TalkBack reads the result of an action
      // without the user having to go looking for it.
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      entering={reduceMotion ? undefined : FadeInDown.duration(220)}
      exiting={reduceMotion ? undefined : FadeOutDown.duration(180)}
      pointerEvents="box-none"
      style={[
        styles.container,
        {
          bottom: insets.bottom + 68,
          backgroundColor: colors.surfaceRaised,
          borderColor: colors.border,
          ...shadows.fab[scheme],
        },
      ]}
    >
      <Icon name={icon} size={18} color={danger ? colors.danger : colors.success} />
      <Text variant="callout" numberOfLines={2} style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
          onPress={() => {
            onAction();
            onDismiss();
          }}
          hitSlop={8}
          style={({ pressed }) => [
            styles.action,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Text variant="headline" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    paddingLeft: space.lg,
    paddingRight: space.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: { flex: 1 },
  action: {
    minHeight: 40,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
  },
});

/**
 * Binds the snackbar to the store.
 *
 * Mounted once, at the root, because any screen can raise one — including a delete
 * that was triggered from a sheet which has already closed. Keeping the binding here
 * means a caller only ever has to say *what* happened, never where to show it.
 *
 * Undo is rendered whenever the raised snackbar carries an undo callback, which is
 * what makes a destructive action reversible without a confirmation dialog.
 */
export function SnackbarHost() {
  const snackbar = useUiStore((state) => state.snackbar);
  const dismissSnackbar = useUiStore((state) => state.dismissSnackbar);

  if (!snackbar) return null;

  return (
    <Snackbar
      message={snackbar.message}
      tone={snackbar.tone}
      actionLabel={snackbar.undo ? 'Undo' : undefined}
      onAction={snackbar.undo}
      onDismiss={dismissSnackbar}
    />
  );
}