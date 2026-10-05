import { memo, useMemo } from 'react';
import { Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { useTheme } from '@/theme/context';
import { radius, space, type CategoryPalette } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type ChipProps = Omit<PressableProps, 'style'> & {
  label: string;
  selected?: boolean;
  /** Widened for category glyphs, which come from the database as plain strings. */
  icon?: IconName | (string & {});
  /** When present the chip takes the category palette instead of the accent. */
  palette?: CategoryPalette;
  onPress?: () => void;
  accessibilityLabel?: string;
};

/**
 * Filter / selector chip.
 *
 * Selection is shown three ways at once — tint wash, glyph weight, and a check —
 * so it survives both a colour-vision difference and a greyscale screenshot.
 * Unselected chips are outlined rather than filled, which keeps a long filter row
 * visually quiet until something is chosen.
 *
 * Memoised: category chips render in a horizontally scrolling row where each item
 * re-renders on every keystroke of the search field.
 *
 * ```tsx
 * <Chip label="Work" icon="briefcase" palette={workPalette} selected={on} onPress={toggle} />
 * ```
 */
export const Chip = memo(function Chip({
  label,
  selected = false,
  icon,
  palette,
  onPress,
  accessibilityLabel,
  ...rest
}: ChipProps) {
  const { colors } = useTheme();

  const style = useMemo(() => {
    if (selected && palette) {
      return { backgroundColor: palette.tintStrong, borderColor: palette.solid };
    }
    if (selected) {
      return { backgroundColor: colors.accentSoft, borderColor: colors.accent };
    }
    return { backgroundColor: 'transparent', borderColor: colors.border };
  }, [selected, palette, colors]);

  const foreground = selected
    ? palette
      ? palette.onTint
      : colors.accent
    : colors.textMuted;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        style,
        pressed ? { opacity: 0.72 } : null,
      ]}
      {...rest}
    >
      {icon ? <Icon name={icon} size={16} color={foreground} strokeWidth={selected ? 2 : 1.75} /> : null}
      <Text variant="callout" tone={selected ? 'accent' : 'muted'} style={selected && palette ? { color: palette.onTint } : null}>
        {label}
      </Text>
    </Pressable>
  );
});

type CategoryPillProps = {
  label: string;
  /** Category glyph, stored as a string on the category row. */
  glyph: string;
  palette: CategoryPalette;
  /** `solid` inverts to a filled pill for a single selected state. */
  emphasis?: 'tint' | 'solid';
  compact?: boolean;
};

/**
 * Read-only category marker.
 *
 * Deliberately *not* a control: a pill in a timeline row only ever tells you what
 * an activity is, so it carries no button role and no pressed state. Use `Chip`
 * when the category is something the user can change.
 *
 * ```tsx
 * <CategoryPill label="Work" glyph="briefcase" palette={palette} />
 * ```
 */
export const CategoryPill = memo(function CategoryPill({
  label,
  glyph,
  palette,
  emphasis = 'tint',
  compact = false,
}: CategoryPillProps) {
  const { colors } = useTheme();
  const solid = emphasis === 'solid';
  const foreground = solid ? colors.onSolid : palette.onTint;

  return (
    <View
      style={[
        styles.base,
        compact ? styles.compact : null,
        {
          backgroundColor: solid ? palette.solid : palette.tint,
          borderColor: solid ? palette.solid : 'transparent',
        },
      ]}
    >
      <Icon name={glyph} size={compact ? 12 : 14} color={foreground} />
      <Text variant="caption" numberOfLines={1} style={{ color: foreground }}>
        {label}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: space.xs + 2,
    paddingHorizontal: space.sm,
    height: 26,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  compact: {
    height: 22,
    paddingHorizontal: 6,
    gap: 4,
  },
});