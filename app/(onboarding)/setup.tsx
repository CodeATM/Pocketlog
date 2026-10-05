import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Chip, DURATION_PRESETS, Skeleton, Text, hasIcon } from '@/components/ui';
import { useCategories } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/context';
import { space } from '@/theme/tokens';
import { formatDuration } from '@/utils/time';

/**
 * Page two: the two defaults worth setting.
 *
 * Only two questions, because every question added here is one fewer person who
 * finishes. The default category pre-selects the chip row in the add sheet and the
 * default duration pre-fills the picker — together they remove almost all typing
 * from the common case of "I did a thing, for about half an hour".
 *
 * Changes write straight to the persisted store, so "back" is not needed to keep
 * them: there is nothing to submit.
 *
 * ```tsx
 * <Redirect href="/(onboarding)/setup" />
 * ```
 */
export default function OnboardingSetup() {
  const router = useRouter();
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();

  const { data: categories, isLoading } = useCategories();
  const defaultCategoryId = useSettingsStore((state) => state.defaultCategoryId);
  const defaultDurationMinutes = useSettingsStore((state) => state.defaultDurationMinutes);
  const setDefaultCategoryId = useSettingsStore((state) => state.setDefaultCategoryId);
  const setDefaultDurationMinutes = useSettingsStore((state) => state.setDefaultDurationMinutes);

  const next = () => {
    haptics.light();
    router.push('/(onboarding)/finish');
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="display">Make logging instant</Text>
        <Text variant="body" tone="muted">
          Two defaults. Set them once and the add sheet opens ready to save.
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.group}>
          <Text variant="caption" tone="muted">
            Usual category
          </Text>

          {isLoading ? (
            <View style={styles.chipWrap}>
              {[0, 1, 2, 3].map((index) => (
                <Skeleton key={index} width={96} height={34} rounded={false} />
              ))}
            </View>
          ) : (
            <View style={styles.chipWrap}>
              {(categories ?? []).map((row) => (
                <Chip
                  key={row.id}
                  label={row.name}
                  icon={hasIcon(row.icon) ? row.icon : undefined}
                  palette={category(row.id, scheme === 'dark' ? row.colorDark : row.colorLight)}
                  selected={defaultCategoryId === row.id}
                  onPress={() => {
                    haptics.selection();
                    setDefaultCategoryId(row.id);
                  }}
                />
              ))}
            </View>
          )}
        </View>

        <View style={styles.group}>
          <Text variant="caption" tone="muted">
            Usual duration
          </Text>
          <View style={styles.chipWrap}>
            {DURATION_PRESETS.map((minutes) => (
              <Chip
                key={minutes}
                label={formatDuration(minutes)}
                selected={defaultDurationMinutes === minutes}
                onPress={() => {
                  haptics.selection();
                  setDefaultDurationMinutes(minutes);
                }}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.xl }]}>
        <Button label="Continue" onPress={next} size="lg" fullWidth />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.xl },
  body: { gap: space.xl, padding: space.xl },
  group: { gap: space.md },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  footer: { paddingHorizontal: space.xl, paddingTop: space.md },
});