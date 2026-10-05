import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Eyebrow, FadeInView, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';

/**
 * Page one: what this app is, in one sentence, plus what it will not do.
 *
 * The "no account, no network, no notifications" line is not filler. Those three
 * absences are what a logger is actually for, and saying so up front is the honest
 * version of a permissions prompt this app never has to show.
 *
 * ```tsx
 * <Redirect href="/(onboarding)/setup" />
 * ```
 */
export default function OnboardingWelcome() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const next = () => {
    haptics.light();
    router.push('/(onboarding)/setup');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.body}>
        <FadeInView>
          <Eyebrow tone="accent">PocketLog</Eyebrow>
          <Text variant="display" style={styles.title}>
            A record of what you actually did with your time.
          </Text>
          <Text variant="body" tone="muted">
            Log an activity, give it a duration, and leave. Everything else — the
            calendar, the charts, the search — is derived from that.
          </Text>
        </FadeInView>

        <View style={[styles.pledges, { borderColor: colors.border, backgroundColor: colors.surface }]}>
          {[
            'No account. Nothing to sign up for.',
            'No network. It works on a plane and stays on this device.',
            'No notifications. It never asks for attention.',
          ].map((line) => (
            <Text key={line} variant="callout" tone="muted">
              {line}
            </Text>
          ))}
        </View>
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <Button label="Get started" onPress={next} size="lg" fullWidth />
        <Text variant="caption" tone="faint" align="center">
          Three screens. You can change all of it later.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  body: { flex: 1, justifyContent: 'center', gap: space.xl, paddingHorizontal: space.xl },
  title: { marginBottom: space.md },
  pledges: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  footer: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.xl },
});