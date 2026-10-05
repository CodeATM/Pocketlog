import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/context';
import { hitSize, radius } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  /** Required: an icon-only control is meaningless to a screen reader without one. */
  name: IconName;
  /** Spoken name of the action. Never the glyph name. */
  label: string;
  size?: number;
  tone?: 'default' | 'accent' | 'danger';
  variant?: 'ghost' | 'tonal';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * Square icon-only control.
 *
 * Always 44×44 regardless of glyph size, so the touch target never shrinks with
 * the artwork. `label` is mandatory because there is no visible text to fall back
 * on; `accessibilityHint` carries the verb when the name alone is ambiguous
 * ("Back" → hint "Go to the previous screen").
 *
 * ```tsx
 * <IconButton name="settings" label="Settings" onPress={openSettings} />
 * ```
 */
export function IconButton({
  name,
  label,
  size = 22,
  tone = 'default',
  variant = 'ghost',
  disabled = false,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();

  const foreground = disabled
    ? colors.textFaint
    : tone === 'accent'
      ? colors.accent
      : tone === 'danger'
        ? colors.danger
        : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={4}
      style={({ pressed }) => [
        styles.base,
        variant === 'tonal'
          ? { backgroundColor: pressed && !disabled ? colors.surfaceSunken : colors.surface, borderWidth: 1, borderColor: colors.border }
          : { backgroundColor: pressed && !disabled ? colors.surfaceSunken : 'transparent' },
        style,
      ]}
      {...rest}
    >
      <Icon name={name} size={size} color={foreground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: hitSize,
    height: hitSize,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});