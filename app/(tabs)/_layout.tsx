import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/TabBar';
import { useTheme } from '@/theme/context';

/**
 * Four tabs, one gear.
 *
 * Settings is deliberately *not* a tab: it is reached from the gear in the Today
 * header, which keeps the tab bar to the four things you actually came to do.
 *
 * `sceneStyle` rather than `sceneContainerStyle`, and the colour comes from the live
 * theme so the background never flashes the wrong scheme between navigations.
 */
export default function TabsLayout() {
  const { colors } = useTheme();

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Today' }} />
      <Tabs.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
      <Tabs.Screen name="search" options={{ title: 'Search' }} />
    </Tabs>
  );
}