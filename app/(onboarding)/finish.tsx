import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, CountUpNumber, SegmentedControl, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';

/**
 * Page three: appearance, then out.
 *
 * Theme is the only setting that changes what the app *feels* like rather than how
 * it behaves, so it is the one worth asking about. The swatch shows the live accent
 * against the live background, so "Dark" is a decision you can make from the preview
 * rather than by toggling and navigating back.
 *
 * The finish handler is the only place `hasOnboarded` flips, which makes the gate in
 * the root layout a one-line read and makes "Skip" and "Finish" identical by
 * construction — there is no branch in the routing that could disagree.
 */
export default function OnboardingFinish() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const themeMode = useSettingsStore((state) => state.themeMode);
  const setThemeMode = useSettingsStore((state) => state.setThemeMode);
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);

  const finish = () => {
    completeOnboarding();
    haptics.success();
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.body}>
        <Text variant="display">Pick a light or a dark</Text>
        <Text variant="body" tone="muted">
          Change it whenever you like. It follows the system until you pick one.
        </Text>

        <View style={[styles.preview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <CountUpNumber value={42} tone="primary" />
          <Text variant="callout" tone="muted">
            An accent that only appears where something is actionable.
          </Text>
        </View>

        <SegmentedControl
          value={themeMode}
          onChange={(next) => {
            haptics.selection();
            setThemeMode(next);
          }}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <Button label="Start logging" onPress={finish} size="lg" fullWidth />
        <Button label="Skip for now" variant="ghost" onPress={finish} fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', gap: space.xl, paddingHorizontal: space.xl },
  preview: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  swatch: { width: space.huge, height: 6, borderRadius: radius.pill },
  footer: { gap: space.sm, paddingHorizontal: space.xl, paddingTop: space.xl },
});