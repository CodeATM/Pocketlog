import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from 'expo-router/js-tabs';

import { Icon, Text, type IconName } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { useTheme } from '@/theme/context';
import { hitSlop, layout, motion, radius, space } from '@/theme/tokens';

/**
 * Custom tab bar.
 *
 * Replaces the platform bar for one reason: the spec treats the tab bar as part of
 * the object, and Expo Router's `tabBar` render prop keeps it inside the React tree
 * so it can be themed and animated. Everything else — the 44pt targets, the
 * `tab`/`selected` roles — is standard accessibility behaviour applied to a custom
 * surface rather than reinvented navigation.
 *
 * **The rule, not the pill.** The earlier version marked selection three ways that
 * all lived *behind* the glyph: a tinted pill, a heavier stroke and a label that
 * appeared only on the selected tab. That made selection read as a highlight rather
 * than as position, and the label appearing and disappearing shifted the whole row
 * sideways every time you changed tab.
 *
 * So selection is now positional: every label is always present, and a short accent
 * rule sits on the bar's top edge, sliding between tabs on a spring. A rule that
 * travels is legible without colour, survives greyscale, and doubles as a progress
 * cue — you can see how far along the row you are. Colour and stroke weight still
 * reinforce it for anyone who reads those faster.
 *
 * The rule is drawn over the top hairline rather than beside it, so the selected tab
 * looks like it is pulling the bar's edge up to meet it.
 *
 * Press feedback is a small scale on the glyph, not a colour change: it reads as the
 * tab taking weight rather than as a state change, and it respects the reduce-motion
 * preference instead of merely running faster.
 *
 * ```tsx
 * <Tabs tabBar={(props) => <TabBar {...props} />} />
 * ```
 */

type TabSpec = {
  name: string;
  label: string;
  icon: IconName;
  accessibilityLabel: string;
  accessibilityHint: string;
};

const TABS: TabSpec[] = [
  {
    name: 'index',
    label: 'Today',
    icon: 'sun',
    accessibilityLabel: 'Today',
    accessibilityHint: "Shows today's activities.",
  },
  {
    name: 'calendar',
    label: 'Calendar',
    icon: 'calendar',
    accessibilityLabel: 'Calendar',
    accessibilityHint: 'Shows your log by day.',
  },
  {
    name: 'insights',
    label: 'Insights',
    icon: 'chart',
    accessibilityLabel: 'Insights',
    accessibilityHint: 'Shows where your time went.',
  },
  {
    name: 'search',
    label: 'Search',
    icon: 'search',
    accessibilityLabel: 'Search',
    accessibilityHint: 'Searches your log.',
  },
];

/** How much of a tab's width the travelling rule occupies. */
const RULE_SHARE = 0.34;
/** How far the glyph dips when a tab is held. */
const PRESS_SCALE = 0.1;

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const { colors, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();

  // Measured rather than assumed: the bar is full-bleed, so hard-coding a width
  // would drift on a split-screen or foldable layout.
  const [barWidth, setBarWidth] = useState(0);
  const slot = barWidth / TABS.length;

  const index = state.index;

  const cursor = useSharedValue(index);
  useEffect(() => {
    cursor.value = index;
  }, [cursor, index]);

  const ruleStyle = useAnimatedStyle(() => {
    const target = cursor.value * slot + (slot * (1 - RULE_SHARE)) / 2;
    return {
      width: slot * RULE_SHARE,
      transform: [{ translateX: reduceMotion ? target : withSpring(target, motion.spring) }],
    };
  });

  return (
    <View
      onLayout={(event) => setBarWidth(event.nativeEvent.layout.width)}
      style={[
        styles.bar,
        {
          backgroundColor: colors.chrome,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, layout.minBottomInset),
        },
      ]}
    >
      {slot > 0 ? (
        <Animated.View
          // Decorative: the selection itself is announced by each tab's `selected`
          // state, so a rule that slid around would only add noise to a screen reader.
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.rule,
            { top: -StyleSheet.hairlineWidth, backgroundColor: colors.accent },
            ruleStyle,
          ]}
        />
      ) : null}

      {state.routes.map((route, routeIndex) => {
        const spec = TABS.find((tab) => tab.name === route.name);
        if (!spec) return null;

        const focused = index === routeIndex;
        const options = descriptors[route.key]?.options;
        const title =
          typeof options?.title === 'string' && options.title.length > 0
            ? options.title
            : spec.label;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          // Re-tapping the current tab is a no-op rather than a scroll-to-top, so
          // the gesture stays predictable.
          if (focused || event.defaultPrevented) return;
          haptics.selection();
          navigation.navigate(route.name, route.params);
        };

        return (
          <TabItem
            key={route.key}
            spec={spec}
            title={title}
            focused={focused}
            reduceMotion={reduceMotion}
            accent={colors.accent}
            idle={colors.textFaint}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  spec,
  title,
  focused,
  reduceMotion,
  accent,
  idle,
  onPress,
}: {
  spec: TabSpec;
  title: string;
  focused: boolean;
  reduceMotion: boolean;
  accent: string;
  idle: string;
  onPress: () => void;
}) {
  const pressed = useSharedValue(0);

  const glyphStyle = useAnimatedStyle(() => {
    const scale = 1 - pressed.value * PRESS_SCALE;
    // Reduced motion still gets the feedback, just without the overshoot — the point
    // of the preference is to remove movement, not to remove confirmation.
    return { transform: [{ scale: reduceMotion ? scale : withSpring(scale, motion.spring) }] };
  });

  const color = focused ? accent : idle;

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={spec.accessibilityLabel}
      accessibilityHint={spec.accessibilityHint}
      hitSlop={hitSlop}
      onPress={onPress}
      onPressIn={() => {
        pressed.value = 1;
      }}
      onPressOut={() => {
        pressed.value = 0;
      }}
      style={styles.item}
    >
      <Animated.View style={[styles.glyph, glyphStyle]}>
        <Icon name={spec.icon} size={22} color={color} strokeWidth={focused ? 2.25 : 1.75} />
      </Animated.View>

      <Text variant="caption" style={{ color }} numberOfLines={1}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: layout.tabBarHeight,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    minHeight: hitSlop.top + 40,
  },
  glyph: { height: 26, justifyContent: 'center' },
  // Rounded so the rule reads as a drawn mark sitting on the edge rather than as a
  // border that stops short.
  rule: {
    position: 'absolute',
    left: 0,
    height: 3,
    borderRadius: radius.pill,
  },
});