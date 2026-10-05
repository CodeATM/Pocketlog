import type { TextStyle, ViewStyle } from 'react-native';

/**
 * PocketLog — design tokens.
 *
 * Everything visual resolves through this file: no component may contain a hex
 * value, a raw spacing number or a font size. Colours are semantic (a role, not a
 * hue) and exist in both themes, so a component never branches on the scheme.
 *
 * Accent: burnt vermilion. The app is meant to read as a printed daily log, and a
 * single saturated stamp-red is the only chromatic event in an otherwise warm
 * neutral palette — so "this is actionable" is legible before the label is read,
 * and it never collides with the seven desaturated category hues.
 */

export type ColorScheme = 'light' | 'dark';

/* ------------------------------------------------------------------ colour -- */

const INK_LIGHT = '#1A1816';
const INK_DARK = '#F2EEE8';

type SchemeColors = {
  /** Page background. */
  bg: string;
  /** Default card / sheet background, one step up from `bg`. */
  surface: string;
  /** One more step up: pressed cards, floating chips, picker popovers. */
  surfaceRaised: string;
  /** One step down: wells, tracks, inset rows. */
  surfaceSunken: string;
  /**
   * Hairline separator. Deliberately low-contrast: it divides, it does not identify
   * anything, so WCAG 1.4.11 does not apply and it stays a whisper.
   */
  border: string;
  /**
   * Separator that *is* load-bearing — input edges, selected rows — so it clears
   * 3:1 against both `bg` and `surface`.
   */
  borderStrong: string;
  /** Primary text. */
  text: string;
  /** Secondary text. Tuned to clear 4.5:1 on `bg` in both themes. */
  textMuted: string;
  /** Decorative marks only (axis ticks, rules, disabled glyphs) — never a label. */
  textFaint: string;
  accent: string;
  accentPressed: string;
  /** Text drawn on top of a filled `accent` surface. */
  onAccent: string;
  /**
   * Text drawn on top of a filled *category* solid. Category solids are dark in
   * the light scheme and pale in the dark scheme, so the foreground flips with
   * the theme rather than being fixed to white.
   */
  onSolid: string;
  /** 14% accent wash for selected chips and soft buttons. */
  accentSoft: string;
  danger: string;
  dangerPressed: string;
  onDanger: string;
  /** 14% danger wash for destructive chips and banners. */
  dangerSoft: string;
  success: string;
  /** Translucent chrome for the tab bar; keeps text legible over content. */
  chrome: string;
  /** Native date/time picker and alert background, so modals match the theme. */
  overlay: string;
};

export const colors: Record<ColorScheme, SchemeColors> = {
  light: {
    bg: '#F6F3EE',
    surface: '#FBF9F5',
    surfaceRaised: '#FFFFFF',
    surfaceSunken: '#EDE8E0',
    border: 'rgba(26, 24, 22, 0.09)',
    borderStrong: 'rgba(26, 24, 22, 0.48)',
    text: INK_LIGHT,
    textMuted: 'rgba(26, 24, 22, 0.64)',
    textFaint: 'rgba(26, 24, 22, 0.48)',
    accent: '#A8482A',
    accentPressed: '#8C3A21',
    onAccent: '#FFFFFF',
    accentSoft: 'rgba(168, 72, 42, 0.10)',
    onSolid: '#FFFFFF',
    danger: '#A32A20',
    dangerPressed: '#8A2019',
    onDanger: '#FFFFFF',
    dangerSoft: 'rgba(163, 42, 32, 0.11)',
    success: '#1F6B4A',
    chrome: 'rgba(251, 249, 245, 0.9)',
    overlay: 'rgba(26, 24, 22, 0.32)',
  },
  dark: {
    bg: '#0F0E0D',
    surface: '#171513',
    surfaceRaised: '#1F1D1A',
    surfaceSunken: '#0A0908',
    border: 'rgba(242, 238, 232, 0.11)',
    borderStrong: 'rgba(242, 238, 232, 0.39)',
    text: INK_DARK,
    textMuted: 'rgba(242, 238, 232, 0.55)',
    textFaint: 'rgba(242, 238, 232, 0.39)',
    accent: '#E0855A',
    accentPressed: '#C96F44',
    onAccent: '#1A0F0A',
    accentSoft: 'rgba(224, 133, 90, 0.16)',
    onSolid: '#12100E',
    danger: '#E8836F',
    dangerPressed: '#D06A55',
    onDanger: '#2A0F0A',
    dangerSoft: 'rgba(232, 131, 111, 0.15)',
    success: '#7BA57F',
    chrome: 'rgba(23, 21, 19, 0.92)',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

/* --------------------------------------------------------------- categories -- */

/**
 * The seven defaults. Slightly desaturated so no single bar on the Insights
 * screen shouts, and every `solid` clears 4.5:1 against its own theme's `bg`.
 *
 * Hue is never the only channel: each category also owns a distinct Lucide glyph,
 * so the timeline, calendar density arcs and search chips stay readable without
 * relying on colour discrimination.
 */
export const CATEGORY_IDS = [
  'work',
  'study',
  'health',
  'ideas',
  'social',
  'personal',
  'other',
] as const;

export type CategoryId = (typeof CATEGORY_IDS)[number];

/** Hex solids per theme, stored in SQLite alongside each category row. */
export const categorySolids: Record<ColorScheme, Record<CategoryId, string>> = {
  light: {
    work: '#8A5A2B',
    study: '#3E5C8A',
    health: '#3F6B45',
    ideas: '#6B4C7A',
    social: '#A25062',
    personal: '#4E5A5E',
    other: '#6B6259',
  },
  dark: {
    work: '#C99055',
    study: '#7C9BC9',
    health: '#7BA57F',
    ideas: '#A98BC0',
    social: '#D08A98',
    personal: '#93A3A8',
    other: '#A49B90',
  },
};

/** Category glyphs, from the same Lucide set as every other icon. */
export const categoryGlyphs: Record<CategoryId, string> = {
  work: 'briefcase',
  study: 'book-open',
  health: 'heart-pulse',
  ideas: 'lightbulb',
  social: 'users',
  personal: 'user',
  other: 'shapes',
};

const HEX = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i;

/**
 * Applies an alpha channel to a `#rrggbb` solid.
 *
 * Tints are derived from the solid rather than hand-authored, which guarantees a
 * tint is always the same colour at a different opacity and cannot drift out of
 * the palette when a category colour changes.
 */
export function withAlpha(hex: string, alpha: number): string {
  const match = HEX.exec(hex);
  if (!match) return hex;
  const [, r, g, b] = match;
  const value = (part: string | undefined) => Number.parseInt(part ?? '00', 16);
  return `rgba(${value(r)}, ${value(g)}, ${value(b)}, ${alpha})`;
}

/** Blends two `#rrggbb` colours. `amount` 0 returns `from`, 1 returns `to`. */
function mixToward(from: string, to: string, amount: number): string {
  const parse = (hex: string) => {
    const match = HEX.exec(hex);
    if (!match) return null;
    return [1, 2, 3].map((i) => Number.parseInt(match[i] as string, 16));
  };

  const a = parse(from);
  const b = parse(to);
  if (!a || !b) return from;

  return `#${a
    .map((channel, i) => {
      const to = b[i] ?? channel;
      return Math.round(channel + (to - channel) * amount).toString(16).padStart(2, '0');
    })
    .join('')}`;
}

export type CategoryPalette = {
  /** Full-strength colour: glyphs, rails, bars, dots. */
  solid: string;
  /** ~14% wash for chip backgrounds and tinted headers. */
  tint: string;
  /** ~26% wash for chart fills that need more presence than `tint`. */
  tintStrong: string;
  /** Text colour for use on `tint` or `tintStrong`. Clears 4.5:1 on both. */
  onTint: string;
};

const TINT_ALPHA = 0.14;
const TINT_STRONG_ALPHA = 0.26;

/**
 * How far `onTint` is pulled from `solid` toward the theme's ink.
 *
 * The solid alone is not legible on `tintStrong`: at 26% the wash is dark enough in
 * the light scheme that an unchanged solid drops to ~3.5:1. Mixing 20% toward ink
 * lifts every category to 4.6:1 or better while staying recognisably the same hue,
 * so a chip still reads as "that colour" at a glance.
 *
 * `scripts/check-contrast.mjs` verifies this number against both washes in both
 * themes — raising `TINT_STRONG_ALPHA` will fail that script.
 */
const ON_TINT_INK_MIX = 0.24;

export function categoryPalette(scheme: ColorScheme, solid: string): CategoryPalette {
  return {
    solid,
    tint: withAlpha(solid, TINT_ALPHA),
    tintStrong: withAlpha(solid, TINT_STRONG_ALPHA),
    onTint: mixToward(solid, scheme === 'dark' ? INK_DARK : INK_LIGHT, ON_TINT_INK_MIX),
  };
}

/** Palette for a built-in category id. */
export function defaultCategoryPalette(
  scheme: ColorScheme,
  id: string,
): CategoryPalette {
  const solid = categorySolids[scheme][id as CategoryId] ?? categorySolids[scheme].other;
  return categoryPalette(scheme, solid);
}

/* --------------------------------------------------------------- typography -- */

/**
 * One family.
 *
 * Poppins does all of the work. It stands in for Proxima Nova, which is a
 * Commercial Type licence and cannot be redistributed in this repo. Being geometric
 * and circular with a tall x-height, it reads larger than Inter did at the same
 * size, so the display steps are set a little smaller than a text face would need
 * and every role carries tighter tracking than the point size alone implies.
 *
 * There is deliberately no second family: a display serif next to a geometric sans
 * read as two apps stapled together rather than one voice.
 */
export const fontFamilies = {
  sans: {
    regular: 'Poppins_400Regular',
    semibold: 'Poppins_600SemiBold',
  },
} as const;

export type TypeVariant =
  | 'display'
  /** `display` one step down, for a screen header that shares its row with controls. */
  | 'displayCompact'
  | 'title1'
  | 'title2'
  | 'headline'
  /**
   * Action labels. Semibold at 17pt: small enough to fit a short button without
   * truncating, large enough to stay legible at the minimum touch target.
   */
  | 'buttonLabel'
  | 'body'
  | 'callout'
  | 'caption'
  /**
   * Axis and scale tick labels. The smallest role in the app, and the only one
   * exempt from Dynamic Type — a duration scale whose labels grow would stop lining
   * up with the track they annotate.
   */
  | 'axisLabel'
  | 'numericLarge'
  | 'numericSmall';

type VariantSpec = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
  /** Cap on the OS Dynamic Type multiplier for this role. */
  maxScale: number;
};

export const typography: Record<TypeVariant, VariantSpec> = {
  display: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 38,
    lineHeight: 44,
    letterSpacing: -1.2,
    maxScale: 1.3,
  },
  displayCompact: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -1,
    maxScale: 1.3,
  },
  title1: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 25,
    lineHeight: 30,
    letterSpacing: -0.6,
    maxScale: 1.35,
  },
  title2: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
    maxScale: 1.4,
  },
  headline: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.2,
    maxScale: 1.5,
  },
  buttonLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: -0.1,
    maxScale: 1.4,
  },
  body: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 16,
    lineHeight: 23,
    letterSpacing: -0.1,
    maxScale: 1.6,
  },
  callout: {
    fontFamily: fontFamilies.sans.regular,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  caption: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    maxScale: 1.5,
  },
  axisLabel: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
    maxScale: 1,
  },
  numericLarge: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.4,
    maxScale: 1.3,
  },
  numericSmall: {
    fontFamily: fontFamilies.sans.semibold,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 0,
    maxScale: 1.5,
  },
};

/** Roles that must align in a column, so they get tabular figures. */
export const tabularVariants: ReadonlySet<TypeVariant> = new Set<TypeVariant>([
  'display',
  'displayCompact',
  'title1',
  'title2',
  'numericLarge',
  'numericSmall',
]);

/* ------------------------------------------------------------------ spacing -- */

/** 4pt grid. Nothing outside this scale is used for layout. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  /** Inputs, chips, small controls. */
  sm: 10,
  /** Cards and list rows. */
  md: 16,
  /** Bottom sheets. */
  lg: 28,
  pill: 999,
} as const;

/** Minimum touch target, per the platform accessibility guidelines. */
export const hitSize = 44;

export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 } as const;

/* ------------------------------------------------------------------- motion -- */

export const motion = {
  /** Colour and opacity changes. */
  fast: 180,
  /** Standard element transitions. */
  base: 240,
  /** Sheets, large reflows. */
  slow: 280,
  spring: { damping: 26, stiffness: 240, mass: 0.7 },
} as const;

/* ---------------------------------------------------------------- elevation -- */

/**
 * Shadows are deliberately scarce: depth is expressed with hairline borders and
 * one-step tonal surfaces instead. Only two things genuinely float above content —
 * the add button and a bottom sheet — and those are the only ones that cast.
 */
function shadow(color: string, opacity: number, radiusPx: number, height: number, elevation: number) {
  return {
    shadowColor: color,
    shadowOpacity: opacity,
    shadowRadius: radiusPx,
    shadowOffset: { width: 0, height },
    elevation,
  } satisfies ViewStyle;
}

export const shadows = {
  fab: {
    light: shadow('#3A2318', 0.18, 16, 6, 6),
    dark: shadow('#000000', 0.55, 18, 6, 8),
  },
  sheet: {
    light: shadow('#3A2318', 0.14, 28, -4, 12),
    dark: shadow('#000000', 0.6, 30, -4, 16),
  },
  /** The duration track's handle, which has to read as raised off the rail. */
  knob: {
    light: shadow('#3A2318', 0.22, 6, 0, 2),
    dark: shadow('#000000', 0.5, 6, 0, 2),
  },
} as const;

/* ------------------------------------------------------------------- layout -- */

export const layout = {
  /** Slim, flat tab bar. Content insets are derived from this plus safe area. */
  tabBarHeight: 56,
  /** Horizontal page margin. */
  gutter: 20,
  /** Reading measure cap so long notes stay comfortable on tablets. */
  maxContentWidth: 560,
  /** Home indicator / home button height when a device reports no inset. */
  minBottomInset: 8,
} as const;

export type TextTone =
  | 'primary'
  | 'muted'
  | 'faint'
  | 'accent'
  | 'danger'
  | 'success'
  | 'onAccent';

export function toneColor(tone: TextTone, scheme: ColorScheme): string {
  const c = colors[scheme];
  switch (tone) {
    case 'primary':
      return c.text;
    case 'muted':
      return c.textMuted;
    case 'faint':
      return c.textFaint;
    case 'accent':
      return c.accent;
    case 'danger':
      return c.danger;
    case 'success':
      return c.success;
    case 'onAccent':
      return c.onAccent;
  }
}

export type TextStyleName = `${TypeVariant}-${TextTone}`;

/** Resolves a variant + tone into a React Native text style. */
export function textStyle(
  variant: TypeVariant,
  tone: TextTone,
  scheme: ColorScheme,
): TextStyle {
  const spec = typography[variant];
  return {
    fontFamily: spec.fontFamily,
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    letterSpacing: spec.letterSpacing,
    color: toneColor(tone, scheme),
    ...(tabularVariants.has(variant) ? { fontVariant: ['tabular-nums'] as const } : null),
  };
}