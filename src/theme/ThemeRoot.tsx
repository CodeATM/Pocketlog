import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';

import { useSettingsStore } from '@/stores/settingsStore';

import { ThemeProvider, type AppTheme } from './context';
import { fontAssets } from './fonts';
import { categoryPalette, categorySolids, colors, defaultCategoryPalette, type ColorScheme } from './tokens';

/**
 * Resolves the active scheme, keeps the OS chrome in step with it, and watches
 * the accessibility "reduce motion" switch.
 *
 * Fonts are loaded here rather than in the root layout so that every consumer of
 * `useTheme` — including the gallery and the splash fallback — shares one
 * readiness gate.
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const [fontsLoaded] = useFonts(fontAssets);

  const themeMode = useSettingsStore((state) => state.themeMode);
  const motionPreference = useSettingsStore((state) => state.motion);
  const systemScheme = useColorScheme();

  const scheme: ColorScheme =
    themeMode === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : themeMode;

  const [systemReduceMotion, setSystemReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setSystemReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (enabled) => {
      setSystemReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors[scheme].bg).catch(() => {});
  }, [scheme]);

  const theme = useMemo<AppTheme>(
    () => ({
      scheme,
      colors: colors[scheme],
      category: (id, solid) => {
        if (solid) return categoryPalette(scheme, solid);
        const known = categorySolids[scheme][id as keyof typeof categorySolids[ColorScheme]];
        return known ? categoryPalette(scheme, known) : defaultCategoryPalette(scheme, id);
      },
      reduceMotion: motionPreference === 'system' ? systemReduceMotion : motionPreference === 'always',
    }),
    [scheme, motionPreference, systemReduceMotion],
  );

  const navigationTheme = useMemo(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: scheme === 'dark',
      colors: {
        ...base.colors,
        primary: colors[scheme].accent,
        background: colors[scheme].bg,
        card: colors[scheme].surface,
        text: colors[scheme].text,
        border: colors[scheme].border,
        notification: colors[scheme].accent,
      },
    };
  }, [scheme]);

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={theme}>
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        {children}
      </NavigationThemeProvider>
    </ThemeProvider>
  );
}