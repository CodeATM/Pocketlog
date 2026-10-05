import { createContext, useContext } from 'react';

import {
  colors as schemeColors,
  type CategoryPalette,
  type ColorScheme,
} from './tokens';

export type AppTheme = {
  scheme: ColorScheme;
  /** Semantic colours for the active scheme. Never indexed by category here. */
  colors: (typeof schemeColors)[ColorScheme];
  /**
   * Full palette for a category, including its derived tints. Falls back to
   * `other` for an unknown id so a stale database row cannot crash a render.
   */
  category: (id: string, solid?: string) => CategoryPalette;
  /** True when either the OS or the in-app preference asks for less motion. */
  reduceMotion: boolean;
};

const ThemeContext = createContext<AppTheme | null>(null);

export const ThemeProvider = ThemeContext.Provider;

export function useTheme(): AppTheme {
  const theme = useContext(ThemeContext);
  if (!theme) {
    throw new Error('useTheme must be called inside <ThemeProvider>.');
  }
  return theme;
}