import { Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/context';
import { radius, space, toneColor, type TextTone } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: 'leading' | 'trailing';
  loading?: boolean;
  fullWidth?: boolean;
  /** Optional second line, used only by the settings sheet's confirm state. */
  hint?: string;
  style?: StyleProp<ViewStyle>;
};

const SIZES: Record<ButtonSize, { height: number; paddingHorizontal: number; gap: number; borderRadius: number }> = {
  sm: { height: 36, paddingHorizontal: space.md, gap: space.xs, borderRadius: radius.sm },
  md: { height: 48, paddingHorizontal: space.lg, gap: space.sm, borderRadius: radius.md },
  lg: { height: 56, paddingHorizontal: space.xl, gap: space.sm, borderRadius: radius.lg },
};

/**
 * The app's action button.
 *
 * Four variants, and only four:
 * - `primary` — the single committing action on a screen (filled accent).
 * - `secondary` — a real alternative action (tonal surface + hairline).
 * - `ghost` — low-emphasis navigation and inline controls (no chrome).
 * - `destructive` — irreversible. Uses `danger`, never the accent.
 *
 * Disabled is a first-class state with its own tone rather than an opacity dip, so
 * "Save" reads as unavailable rather than broken. Height always clears 44pt at
 * the smallest size.
 *
 * ```tsx
 * <Button label="Save activity" onPress={submit} loading={saving} />
 * ```
 */
export function Button({
  label,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'leading',
  loading = false,
  fullWidth = false,
  hint,
  disabled,
  style,
  ...rest
}: Props) {
  const { colors, scheme } = useTheme();
  const dimensions = SIZES[size];
  const isDisabled = disabled === true || loading;

  const tone: Record<ButtonVariant, { bg: string; pressedBg: string; fg: TextTone; border?: string }> = {
    primary: {
      bg: colors.accent,
      pressedBg: colors.accentPressed,
      fg: 'onAccent',
    },
    secondary: {
      bg: colors.surface,
      pressedBg: colors.surfaceSunken,
      fg: 'primary',
      border: colors.borderStrong,
    },
    ghost: {
      bg: 'transparent',
      pressedBg: colors.surfaceSunken,
      fg: 'muted',
    },
    destructive: {
      bg: colors.dangerSoft,
      pressedBg: colors.danger,
      fg: 'danger',
    },
  };

  const palette = tone[variant];
  const disabledPalette = {
    bg: variant === 'primary' ? colors.surfaceSunken : 'transparent',
    fg: 'faint' as TextTone,
  };

  const backgroundColor = isDisabled ? disabledPalette.bg : palette.bg;
  const foreground = isDisabled ? disabledPalette.fg : palette.fg;
  const iconColor = isDisabled ? colors.textFaint : toneColor(palette.fg, scheme);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: dimensions.height,
          paddingHorizontal: dimensions.paddingHorizontal,
          gap: dimensions.gap,
          borderRadius: dimensions.borderRadius,
          backgroundColor: pressed && !isDisabled ? palette.pressedBg : backgroundColor,
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          // Centre the icon+label group on the button's own axis. Without this the
          // inner row wraps its content and sits hard against the leading edge.
          alignItems: 'center',
          justifyContent: 'center',
        },
        fullWidth ? styles.fullWidth : null,
        // A 1pt hairline instead of a shadow: secondary buttons get their edge
        // from a border so they stay flat.
        palette.border && !isDisabled
          ? { borderWidth: 1, borderColor: variant === 'secondary' ? colors.borderStrong : palette.border }
          : null,
        style,
      ]}
      {...rest}
    >
      <View style={[styles.row, icon && iconPosition === 'trailing' ? styles.trailing : null]}>
        {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={iconColor} /> : null}
        <View style={styles.labels}>
          <Text variant={size === 'sm' ? 'callout' : 'buttonLabel'} tone={foreground} numberOfLines={1}>
            {label}
          </Text>
          {hint ? (
            <Text variant="caption" tone="faint" numberOfLines={2}>
              {hint}
            </Text>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  trailing: { flexDirection: 'row-reverse' },
  labels: { alignItems: 'center', gap: 2 },
});