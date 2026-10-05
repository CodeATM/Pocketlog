import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Icon, Text } from '@/components/ui';
import { useTheme } from '@/theme/context';
import { space } from '@/theme/tokens';

/**
 * Unmatched route.
 *
 * An in-app page rather than a platform screen, because a dead link inside an app is
 * usually a stale saved state, and the useful thing to offer is a way back to Today
 * rather than a browser error.
 */
export default function NotFoundRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.bg, paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      <Icon name="compass" size={28} color={colors.textFaint} />

      <Text variant="title1">Nothing here</Text>
      <Text variant="body" tone="muted" align="center">
        This link does not lead anywhere in PocketLog.
      </Text>

      <Button label="Back to Today" onPress={() => router.replace('/(tabs)')} variant="secondary" />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
});