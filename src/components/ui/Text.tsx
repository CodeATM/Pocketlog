import type { ReactNode } from 'react';
import { StyleSheet, Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { useTheme } from '@/theme/context';
import { tabularVariants, textStyle, typography, type TextTone, type TypeVariant } from '@/theme/tokens';

export type TextVariant = TypeVariant;
export type { TextTone };

type Props = Omit<RNTextProps, 'style'> & {
  variant?: TextVariant;
  tone?: TextTone;
  align?: 'left' | 'center' | 'right';
  style?: RNTextProps['style'];
};

/**
 * The only text primitive in the app.
 *
 * `variant` picks a role from the type scale, `tone` picks a semantic colour;
 * components never set fontSize, fontFamily or colour themselves. Dynamic Type is
 * capped per role rather than globally — the display numerals stay legible at
 * 130% while body copy may grow further — so no layout breaks at larger
 * accessibility sizes.
 *
 * ```tsx
 * <Text variant="title2">Saturday</Text>
 * <Text variant="callout" tone="muted">3 October</Text>
 * <Text variant="numericLarge">{formatDuration(minutes)}</Text>
 * ```
 */
export function Text({ variant = 'body', tone = 'primary', align, style, ...rest }: Props) {
  const { scheme } = useTheme();
  const spec = typography[variant];

  return (
    <RNText
      maxFontSizeMultiplier={spec.maxScale}
      style={[
        textStyle(variant, tone, scheme),
        tabularVariants.has(variant) ? styles.tabular : null,
        align === 'center' ? styles.center : align === 'right' ? styles.right : null,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  tabular: { fontVariant: ['tabular-nums'] },
  center: { textAlign: 'center' },
  right: { textAlign: 'right' },
});

/** Small label used above a group of content. */
export function Eyebrow({ children, ...rest }: { children: ReactNode } & Props) {
  return (
    <Text variant="caption" tone="faint" {...rest}>
      {children}
    </Text>
  );
}