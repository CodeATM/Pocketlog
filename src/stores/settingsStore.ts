import Storage from 'expo-sqlite/kv-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { FALLBACK_CATEGORY_ID } from '@/lib/categories';

export type ThemeMode = 'system' | 'light' | 'dark';
export type WeekStart = 0 | 1;
export type MotionPreference = 'system' | 'always' | 'never';

export type SettingsState = {
  themeMode: ThemeMode;
  weekStartsOn: WeekStart;
  defaultCategoryId: string;
  defaultDurationMinutes: number;
  motion: MotionPreference;
  /** Set once the user finishes or skips onboarding; gates `/(onboarding)`. */
  hasOnboarded: boolean;
  /** Most recent first, capped at 8. Local only — the app has no network layer. */
  recentSearches: string[];
  setThemeMode: (value: ThemeMode) => void;
  setWeekStartsOn: (value: WeekStart) => void;
  setDefaultCategoryId: (value: string) => void;
  setDefaultDurationMinutes: (value: number) => void;
  setMotion: (value: MotionPreference) => void;
  completeOnboarding: () => void;
  recordSearch: (value: string) => void;
  clearRecentSearches: () => void;
  resetPreferences: () => void;
};

const DEFAULTS = {
  themeMode: 'system' as ThemeMode,
  // Monday, which is the convention across most of the world.
  weekStartsOn: 1 as WeekStart,
  defaultCategoryId: FALLBACK_CATEGORY_ID,
  defaultDurationMinutes: 30,
  motion: 'system' as MotionPreference,
};

const MAX_RECENT_SEARCHES = 8;

/**
 * Preferences, persisted through `expo-sqlite/kv-store`.
 *
 * Deliberately a separate SQLite file from the activity database: clearing logged
 * data must not silently reset how the app looks, and an activity import must not
 * be able to clobber preferences.
 *
 * `partialize` keeps the stored blob to plain values, so adding a function above
 * never changes the shape on disk.
 */
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      hasOnboarded: false,
      recentSearches: [],
      setThemeMode: (themeMode) => set({ themeMode }),
      setWeekStartsOn: (weekStartsOn) => set({ weekStartsOn }),
      setDefaultCategoryId: (defaultCategoryId) => set({ defaultCategoryId }),
      setDefaultDurationMinutes: (defaultDurationMinutes) => set({ defaultDurationMinutes }),
      setMotion: (motion) => set({ motion }),
      completeOnboarding: () => set({ hasOnboarded: true }),
      recordSearch: (value) =>
        set((state) => {
          const term = value.trim();
          if (term.length === 0) return state;
          return {
            recentSearches: [term, ...state.recentSearches.filter((item) => item !== term)].slice(
              0,
              MAX_RECENT_SEARCHES,
            ),
          };
        }),
      clearRecentSearches: () => set({ recentSearches: [] }),
      resetPreferences: () => set({ ...DEFAULTS }),
    }),
    {
      name: 'pocketlog.settings.v1',
      storage: createJSONStorage(() => Storage),
      partialize: ({
        themeMode,
        weekStartsOn,
        defaultCategoryId,
        defaultDurationMinutes,
        motion,
        hasOnboarded,
        recentSearches,
      }) => ({
        themeMode,
        weekStartsOn,
        defaultCategoryId,
        defaultDurationMinutes,
        motion,
        hasOnboarded,
        recentSearches,
      }),
    },
  ),
);

export const settingsDefaults = DEFAULTS;