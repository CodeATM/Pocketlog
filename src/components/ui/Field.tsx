import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '@/theme/context';
import { fontFamilies, radius, space, typography } from '@/theme/tokens';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type FieldProps = Omit<TextInputProps, 'style'> & {
  label?: string;
  /** Inline validation message; presence switches the border to `danger`. */
  error?: string;
  hint?: string;
  icon?: IconName;
  /** Large variant for the activity title — the sheet's autofocus target. */
  size?: 'md' | 'lg';
  containerStyle?: object;
};

/**
 * Labelled text input.
 *
 * Label sits above the field rather than floating inside it: in a form this short
 * (four fields, one screen) a floating label saves eleven pixels and costs a
 * permanent animated label. Errors are inline and always replace the hint in
 * place, so a validation message never shifts the layout of whatever is below it.
 *
 * The label is associated with the input via `accessibilityLabel`, and the error
 * is announced as part of it — not as a separate node the user has to go hunting
 * for.
 *
 * ```tsx
 * <Field label="Title" value={title} onChangeText={setTitle} size="lg" error={error} />
 * ```
 */
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { label, error, hint, icon, size = 'md', containerStyle, multiline, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const large = size === 'lg';

  return (
    <View style={[styles.field, containerStyle]}>
      {label ? (
        <Text variant="caption" tone="muted">
          {label}
        </Text>
      ) : null}

      <View
        style={[
          styles.inputShell,
          large ? styles.inputShellLarge : null,
          {
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : focused ? colors.accent : colors.border,
            // A 1.5pt border on focus rather than a glow: the field should look
            // *attended to*, not lit up.
            borderWidth: focused || error ? 1.5 : 1,
          },
          multiline ? styles.multiline : null,
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? colors.accent : colors.textMuted} /> : null}
        <TextInput
          ref={ref}
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          // `textFaint` is for de-emphasised decoration; a placeholder is still
          // content the user has to read, so it takes `textMuted`.
          placeholderTextColor={colors.textMuted}
          selectionColor={colors.accent}
          cursorColor={colors.accent}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          multiline={multiline}
          style={[
            styles.input,
            large ? styles.inputLarge : null,
            // Top-aligned for a growing note; the single-line default centres in the
            // full field height instead.
            multiline ? styles.multilineInput : null,
            { color: colors.text },
          ]}
          {...rest}
        />
      </View>

      {error ? (
        <Text variant="caption" tone="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" tone="faint">
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

type TapRowProps = {
  label: string;
  value: string;
  icon?: IconName;
  onPress: () => void;
  /** Right-hand sub-label, e.g. the computed end time on the Start row. */
  trailingNote?: string;
  accessibilityHint?: string;
  /**
   * Renders as a sunken well instead of a raised surface. Use when the row sits
   * inside a card that already provides the surface colour.
   */
  inset?: boolean;
};

/**
 * A row that opens a native picker.
 *
 * Styled as a setting row rather than an input so the date and time pickers do not
 * look like text fields that happen to be disabled. The computed trailing note is
 * what makes the Start row useful: it shows the resulting end time before the
 * picker has even been touched.
 *
 * ```tsx
 * <TapRow label="Start" value={formatTime(start)} icon="clock" onPress={openPicker} />
 * ```
 */
export function TapRow({
  label,
  value,
  icon,
  onPress,
  trailingNote,
  accessibilityHint,
  inset = false,
}: TapRowProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${value}`}
      accessibilityHint={accessibilityHint}
      onPress={onPress}
      // No pressed state. These rows invert to a lighter fill on touch-down, which
      // against the sunken well reads as a hover highlight rather than a press, and
      // it flickers because the picker underneath animates open immediately. The
      // picker's own entrance is the feedback.
      style={[
        styles.tapRow,
        inset
          ? {
              backgroundColor: colors.surfaceSunken,
              // No border of its own: an inset row sits inside a well that already
              // draws the outline, and two hairlines read as a smudge.
              borderWidth: 0,
            }
          : { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {icon ? <Icon name={icon} size={20} color={colors.textMuted} /> : null}
      <View style={styles.tapLabels}>
        <Text variant="caption" tone="muted">
          {label}
        </Text>
        <View style={styles.tapValue}>
          <Text variant="body" numberOfLines={1}>
            {value}
          </Text>
          {trailingNote ? (
            <Text variant="caption" tone="faint" numberOfLines={1}>
              {trailingNote}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.chevron}>
        <Icon name="chevron-right" size={16} color={colors.textFaint} />
      </View>
    </Pressable>
  );
}

/**
 * Collapsible section used for the Notes field in the add sheet.
 *
 * Collapsed by default so the sheet's default height fits on one screen without
 * scrolling — notes are the exception, not the rule.
 */
export function Collapsible({
  title,
  open,
  onToggle,
  children,
  icon,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  icon?: IconName;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.collapsible}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={title}
        onPress={onToggle}
        style={({ pressed }) => [
          styles.collapsibleHeader,
          { backgroundColor: pressed ? colors.surfaceSunken : 'transparent' },
        ]}
      >
        <Icon name={icon ?? 'plus'} size={16} color={colors.textMuted} />
        <Text variant="headline" tone="muted" style={styles.collapsibleTitle}>
          {title}
        </Text>
      </Pressable>
      {open ? <View style={styles.collapsibleBody}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: space.sm },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 48,
    paddingHorizontal: space.md,
    // Matches the `md` button radius so a form and its actions share one geometry.
    borderRadius: radius.md,
    borderWidth: 1,
  },
  inputShellLarge: { minHeight: 56, paddingHorizontal: space.lg },
  multiline: {
    alignItems: 'flex-start',
    paddingVertical: space.md,
    minHeight: 108,
  },
  input: {
    flex: 1,
    // Fills the field's height rather than sitting in a content-sized box that the
    // shell then centres. Centring in the real box is what makes the placeholder
    // look centred: with a short input box, Android balances the glyph run against
    // the box's own padding and the text rides low in a 56pt field.
    alignSelf: 'stretch',
    fontFamily: fontFamilies.sans.regular,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    letterSpacing: typography.body.letterSpacing,
    // Android centres single-line text by its font metrics, not by its line box, so
    // the placeholder rides low against the field's 56pt height without this.
    textAlignVertical: 'center',
  },
  multilineInput: {
    // A note grows downward from its first line; centring it would make the block
    // drift as the text is typed.
    textAlignVertical: 'top',
  },
  inputLarge: {
    fontFamily: fontFamilies.sans.semibold,
    // 19 rather than the 22pt `title2` scale. The placeholder inherits the input's
    // type style, and at 22pt an example string like "Deep work — settings module"
    // ran past the right edge of the field.
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  tapRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 56,
    paddingHorizontal: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tapLabels: { flex: 1, gap: 2 },
  // The note rides on the value's line rather than taking one of its own, so a row
  // with a note is exactly as tall as one without. Equal heights are what put the
  // chevrons of consecutive rows on the same line.
  tapValue: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  // Fixed box so the chevron sits on the row's optical centre whether the row has
  // a trailing note under its value or not.
  chevron: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  collapsible: { gap: space.md },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.xs,
    borderRadius: radius.sm,
  },
  collapsibleTitle: { flex: 1 },
  collapsibleBody: { gap: space.sm },
});