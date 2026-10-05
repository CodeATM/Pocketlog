import { Stack } from 'expo-router';

import { useTheme } from '@/theme/context';

/**
 * Three pages, no header, no gestures.
 *
 * Onboarding renders as its own stack so its own copy and its own transitions do
 * not have to share anything with the tabs it is about to hand over to. The header
 * is off because the content is the interface; a back chevron would invite someone
 * out of a flow they have not chosen yet.
 */
export default function OnboardingLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
        animation: 'fade',
      }}
    />
  );
}