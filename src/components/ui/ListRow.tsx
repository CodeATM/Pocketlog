import { memo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/context';
import { hitSize, space } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  /** Right-aligned value: a toggle, a count, or a short string. */
  value?: string;
  icon?: IconName;
  iconColor?: string;
  onPress?: () => void;
  /** Renders a chevron and marks the row as a navigation affordance. */
  navigable?: boolean;
  tone?: 'default' | 'danger';
  disabled?: boolean;
  /** Hairline between rows; the last row in a group passes `false`. */
  divided?: boolean;
  trailing?: ReactNode;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A row in a settings or metadata list.
 *
 * Used both for interactive rows (Settings, Categories) and read-only ones (the
 * Details metadata block). Dividers are drawn as a hairline inset to the start of
 * the content rather than spanning the full width, which is what makes a group
 * read as a single block instead of a stack of lines.
 *
 * `navigable` is explicit rather than inferred from `onPress`, because a row can
 * be pressable without going anywhere — that distinction is what a screen reader
 * user needs to hear.
 *
 * ```tsx
 * <ListRow title="Week starts on" value="Monday" icon="calendar" onPress={open} navigable />
 * ```
 */
export const ListRow = memo(function ListRow({
  title,
  subtitle,
  value,
  icon,
  iconColor,
  onPress,
  navigable = false,
  tone = 'default',
  disabled = false,
  divided = true,
  trailing,
  accessibilityLabel,
  accessibilityHint,
  style,
}: Props) {
  const { colors } = useTheme();
  const danger = tone === 'danger';
  const foreground = disabled ? colors.textFaint : danger ? colors.danger : colors.text;

  const content = (
    <>
      {icon ? (
        <Icon
          name={icon}
          size={20}
          color={iconColor ?? (disabled ? colors.textFaint : danger ? colors.danger : colors.textMuted)}
        />
      ) : null}

      <View style={styles.labels}>
        <Text variant="body" style={{ color: foreground }} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.trailing}>
        {trailing ?? null}
        {value ? (
          <Text variant="callout" tone={danger ? 'danger' : 'muted'} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {navigable ? <Icon name="chevron-right" size={18} color={colors.textFaint} /> : null}
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View
        style={[
          styles.row,
          divided ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
          style,
        ]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        divided ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border } : null,
        pressed && !disabled ? { backgroundColor: colors.surfaceSunken } : null,
        style,
      ]}
    >
      {content}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: hitSize + 6,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm + 2,
  },
  labels: { flex: 1, gap: 2 },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    maxWidth: '46%',
  },
});