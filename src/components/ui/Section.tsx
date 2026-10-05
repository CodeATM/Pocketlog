import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';

import { Eyebrow, Text } from './Text';

/**
 * Tracking for uppercase eyebrows.
 *
 * Small caps need positive tracking to stay legible — at `caption`'s 0.2 the words
 * would touch at the edges.
 */
const EYEBROW_TRACKING = 1.1;

/**
 * Large section label for grouped content.
 *
 * Set in the eyebrow's tracking and letter-spaced, which separates it
 * from every other kind of label in the app without needing a rule or a colour
 * change. Sections get `space.huge` above them, so the page reads as chapters
 * rather than a single undifferentiated scroll.
 */
export function SectionHeader({
  title,
  /** Right-aligned affordance, e.g. a "Today" jump or a Clear button. */
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.header}>
      <Eyebrow style={[styles.title, { color: colors.textMuted }]}>{title}</Eyebrow>
      {action}
    </View>
  );
}

/**
 * A card: one tonal step up from the page, with a hairline edge.
 *
 * The only container primitive in the app. Depth is a border plus a background
 * shift rather than a shadow — shadows are reserved for the add button and sheets,
 * so a screen full of cards never turns into a stack of floating rectangles.
 *
 * ```tsx
 * <Card padded={false}><ListRow title="…" /></Card>
 * ```
 */
export function Card({
  children,
  padded = true,
  style,
}: {
  children: React.ReactNode;
  padded?: boolean;
  style?: object;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        padded ? styles.padded : null,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A small labelled figure.
 *
 * Used in the Insights summary row. The value is the headline and the label is
 * deliberately quiet, so a row of three reads as three numbers rather than three
 * competing cards.
 */
export function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessible
      accessibilityLabel={`${label}: ${value}${detail ? `. ${detail}` : ''}`}
    >
      <Text variant="caption" tone="faint" numberOfLines={2}>
        {label}
      </Text>
      <Text variant="numericSmall" numberOfLines={1}>
        {value}
      </Text>
      {detail ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {detail}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  // Tracking plus case: an eyebrow reads as a label on a printed page rather than as
// another line of body text. Applied here rather than baked into `caption` because the
// chart axis labels and other small captions share that variant and must stay sentence
// case.
title: { letterSpacing: EYEBROW_TRACKING, textTransform: 'uppercase' },
  card: {
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  padded: { padding: space.lg },
  tile: {
    flex: 1,
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});