import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';

import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type EmptyProps = {
  title: string;
  message?: string;
  icon?: IconName;
  action?: ReactNode;
  /** `inline` sits inside a card or list; `page` fills a whole screen. */
  layout?: 'page' | 'inline';
};

/**
 * Empty state.
 *
 * Typographic on purpose: a short declarative line, an optional question, and one
 * action. No illustration, no confetti, no illustration-shaped drop shadow — the
 * absence of data is the message, and decoration would only compete with it.
 *
 * ```tsx
 * <EmptyState
 *   title="Nothing logged yet"
 *   message="What did you do first today?"
 *   action={<Button label="Log an activity" onPress={open} />}
 * />
 * ```
 */
export function EmptyState({ title, message, icon, action, layout = 'page' }: EmptyProps) {
  const { colors } = useTheme();

  return (
    <View
      style={[styles.base, layout === 'page' ? styles.page : styles.inline, { borderColor: colors.border }]}
    >
      {icon ? <Icon name={icon} size={24} color={colors.textFaint} /> : null}
      <View style={styles.copy}>
        <Text variant="title2" align="center">
          {title}
        </Text>
        {message ? (
          <Text variant="callout" tone="muted" align="center">
            {message}
          </Text>
        ) : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

type ErrorProps = {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
};

/**
 * Error state for a screen that failed to load.
 *
 * Every screen keeps its previous data visible when a refresh fails, so this only
 * appears when there is genuinely nothing to show — a corrupt database or a failed
 * migration, not a transient blip. It always offers the one action that can help.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  retryLabel = 'Try again',
}: ErrorProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.base, styles.page, { borderColor: colors.border, backgroundColor: colors.surface }]}>
      <Icon name="warning" size={24} color={colors.danger} />
      <View style={styles.copy}>
        <Text variant="title2" align="center">
          {title}
        </Text>
        <Text variant="callout" tone="muted" align="center">
          {message}
        </Text>
      </View>
      {onRetry ? (
        <View style={styles.action}>
          <Button label={retryLabel} variant="secondary" size="sm" onPress={onRetry} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  page: {
    paddingVertical: space.xxxl + space.lg,
    minHeight: 240,
  },
  inline: { paddingVertical: space.xl },
  copy: { gap: space.xs + 2, maxWidth: 320 },
  action: { marginTop: space.xs },
});