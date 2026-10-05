import { Redirect, Stack } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { SnackbarHost } from '@/components/ui';
import { DATABASE_NAME, SQLiteProvider, initDatabase } from '@/db/client';
import { ActivitySheet } from '@/features/activity/ActivitySheet';
import { useSettingsStore } from '@/stores/settingsStore';
import { ThemeRoot } from '@/theme/ThemeRoot';
import { useTheme } from '@/theme/context';

/**
 * Root layout.
 *
 * Provider order is load-bearing:
 *
 * 1. `GestureHandlerRootView` — every pan gesture in the app is a child of the
 *    sheet, and it must be the outermost native view or gestures are dropped.
 * 2. `SafeAreaProvider` — insets are read by the tab bar and every screen header,
 *    and they have to come from the real window, not a default.
 * 3. `ThemeRoot` — fonts, scheme, motion preference, and the OS chrome. Screens
 *    below it can assume `useTheme()` never returns null.
 * 4. `SQLiteProvider` — migrations and dev seed run here, and `AppErrorBoundary`
 *    wraps it so a failed migration still renders a readable error.
 *
 * The single `ActivitySheet` and `SnackbarHost` are mounted here rather than per
 * screen: `useAddActivity()` is reachable from anywhere, so its UI has to be too.
 * That also means an edit opened from Home survives navigating away, which is what
 * makes the optimistic close feel safe.
 */

/** Onboarding gate. Once complete, the group unmounts for good. */
function useRedirectToOnboarding() {
  return useSettingsStore((state) => !state.hasOnboarded);
}

function AppRoutes() {
  const { colors } = useTheme();
  const needsOnboarding = useRedirectToOnboarding();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {/*
        The redirect is what actually gates the app. Unmounting the onboarding group
        is not enough on its own: `(tabs)/index` is still a valid initial route, so a
        cold start at `/` could land on Today before the store has been read. A
        `<Redirect>` fires as soon as the tree mounts and wins the initial route, then
        unmounts itself the moment onboarding completes.
      */}
      {needsOnboarding ? <Redirect href="/(onboarding)" /> : null}

      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {needsOnboarding ? (
          <Stack.Screen name="(onboarding)" options={{ animation: 'fade' }} />
        ) : null}
        <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
        <Stack.Screen name="activity/[id]" />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
        <Stack.Screen name="dev/gallery" options={{ presentation: 'modal' }} />
      </Stack>

      <ActivitySheet />
      <SnackbarHost />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppErrorBoundary>
          <ThemeRoot>
            <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase}>
              <AppRoutes />
            </SQLiteProvider>
          </ThemeRoot>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});