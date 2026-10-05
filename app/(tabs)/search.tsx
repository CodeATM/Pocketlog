import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Keyboard, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import {
  Chip,
  EmptyState,
  ErrorState,
  Field,
  Icon,
  SectionHeader,
  hasIcon,
  SkeletonTimeline,
  Text,
  TimelineRow,
} from '@/components/ui';
import { useAddActivity } from '@/hooks/useAddActivity';
import { useCategories, useSearchResults } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import { formatDayHeading, formatMonthHeading } from '@/utils/time';

/**
 * Debounce window for the query.
 *
 * 180ms is the point where typing stops feeling laggy but a whole word still lands as
 * one read — a fast typist covers a four-letter word in well under this.
 */
const DEBOUNCE_MS = 180;

/**
 * Search.
 *
 * A search tab rather than a modal, because the results are worth browsing: the list
 * is a real timeline, grouped by month, and each row opens the same Details screen as
 * everywhere else. Queries are debounced at 180ms — long enough that typing a word
 * costs one query rather than one per keystroke, short enough to feel live.
 *
 * An empty term is not an error and not a query: it shows recent searches, which are
 * persisted locally and never leave the device.
 *
 * ```tsx
 * <SearchScreen />
 * ```
 */
export default function SearchScreen() {
  const router = useRouter();
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();
  const { openEdit, remove } = useAddActivity();

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);

  // Debounce the query itself, not the field. Typing "review" costs one SQLite read
  // instead of six, and the input stays fully responsive while it does.
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(term.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [term]);

  const { data: categories } = useCategories();
  const recentSearches = useSettingsStore((state) => state.recentSearches);
  const recordSearch = useSettingsStore((state) => state.recordSearch);
  const clearRecentSearches = useSettingsStore((state) => state.clearRecentSearches);

  const onChangeText = useCallback((next: string) => setTerm(next), []);

  const { data, isLoading, error, refresh } = useSearchResults(debounced, categoryFilter);

  /**
   * Month groups, newest first, each holding its own day groups.
   *
   * Two levels rather than one: results for "review" can span years, and a flat list
   * of dates makes it hard to see which month a run of entries belongs to. The month
   * header appears once per month; the day headers inside it stay cheap.
   */
  const months = useMemo(() => {
    const byMonth = new Map<string, Map<string, NonNullable<typeof data>>>();

    for (const activity of data ?? []) {
      const month = activity.day.slice(0, 7);
      const days = byMonth.get(month) ?? new Map();
      const bucket = days.get(activity.day);
      if (bucket) bucket.push(activity);
      else days.set(activity.day, [activity]);
      byMonth.set(month, days);
    }

    return [...byMonth.entries()].map(([month, days]) => ({
      month,
      total: [...days.values()].reduce((sum, rows) => sum + rows.length, 0),
      days: [...days.entries()].map(([day, rows]) => ({ day, rows })),
    }));
  }, [data]);

  const resultCount = (data ?? []).length;

  const submit = useCallback(() => {
    const trimmed = term.trim();
    if (trimmed.length === 0) return;
    recordSearch(trimmed);
    Keyboard.dismiss();
  }, [recordSearch, term]);

  const toggleCategory = (id: string) => {
    haptics.selection();
    setCategoryFilter((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const openRecent = (value: string) => {
    haptics.selection();
    setTerm(value);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="title1">Search</Text>

        <Field
          placeholder="Titles, notes and categories"
          value={term}
          onChangeText={onChangeText}
          onSubmitEditing={submit}
          returnKeyType="search"
          icon="search"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {term.trim().length === 0 ? null : (
          <View style={styles.filters}>
            {(categories ?? []).map((row) => (
              <Chip
                key={row.id}
                label={row.name}
                icon={hasIcon(row.icon) ? row.icon : undefined}
                palette={category(row.id, scheme === 'dark' ? row.colorDark : row.colorLight)}
                selected={categoryFilter.includes(row.id)}
                onPress={() => toggleCategory(row.id)}
              />
            ))}
          </View>
        )}
      </View>

      {term.trim().length === 0 ? (
        <View style={styles.recent}>
          <SectionHeader
            title="Recent"
            action={
              recentSearches.length > 0 ? (
                <Pressable accessibilityRole="button" onPress={clearRecentSearches} hitSlop={8}>
                  <Text variant="caption" tone="accent">
                    Clear
                  </Text>
                </Pressable>
              ) : null
            }
          />

          {recentSearches.length === 0 ? (
            <EmptyState
              icon="search"
              title="Nothing searched yet"
              message="Titles, notes and category names are all searchable, and nothing leaves this device."
              layout="inline"
            />
          ) : (
            <View style={styles.recentList}>
              {recentSearches.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`Search for ${value}`}
                  onPress={() => openRecent(value)}
                  style={({ pressed }) => [
                    styles.recentRow,
                    {
                      backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Icon name="clock" size={16} color={colors.textFaint} />
                  <Text variant="body" numberOfLines={1} style={styles.recentLabel}>
                    {value}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}

      {term.trim().length > 0 && error ? (
        <ErrorState
          title="Search failed"
          message={error instanceof Error ? error.message : 'Try again.'}
          onRetry={refresh}
        />
      ) : null}

      {term.trim().length > 0 && !error ? (
        isLoading && resultCount === 0 ? (
          <View style={styles.listPadding}>
            <SkeletonTimeline rows={5} />
          </View>
        ) : resultCount === 0 ? (
          <EmptyState
            icon="search"
            title={`Nothing matches “${term.trim()}”`}
            message="Search covers titles, notes and category names."
            layout="page"
            action={
              categoryFilter.length > 0 ? (
                <Chip label="Clear filters" icon="x" onPress={() => setCategoryFilter([])} />
              ) : null
            }
          />
        ) : (
          <FlatList
            data={months}
            keyExtractor={(group) => group.month}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 120 }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            // Announced as the list settles, so a screen reader hears "12 results"
            // rather than the count buried inside a re-render.
            accessibilityLabel={`${resultCount} ${resultCount === 1 ? 'result' : 'results'}`}
            renderItem={({ item: group }) => (
              <View style={styles.group}>
                <SectionHeader
                  title={formatMonthHeading(`${group.month}-01`)}
                  action={
                    <Text variant="caption" tone="faint">
                      {group.total} {group.total === 1 ? 'entry' : 'entries'}
                    </Text>
                  }
                />

                {group.days.map(({ day, rows }) => (
                  <View key={day} style={styles.dayGroup}>
                    <Text variant="caption" tone="faint" style={styles.dayHeading}>
                      {formatDayHeading(day)}
                    </Text>

                    {rows.map((activity) => (
                      <TimelineRow
                        key={activity.id}
                        item={{
                          id: activity.id,
                          title: activity.title,
                          notes: activity.notes,
                          startedAt: new Date(activity.startedAt),
                          durationMinutes: activity.durationMinutes,
                          categoryName: activity.category.name,
                          glyph: activity.category.icon,
                          isFirst: true,
                          isLast: rows.length === 1,
                          palette: category(
                            activity.category.id,
                            scheme === 'dark' ? activity.category.colorDark : activity.category.colorLight,
                          ),
                        }}
                        onPress={() => router.push(`/activity/${activity.id}`)}
                        onEdit={() => openEdit(activity.id)}
                        onDelete={() => remove(activity)}
                      />
                    ))}
                  </View>
                ))}
              </View>
            )}
          />
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { gap: space.md, paddingHorizontal: space.xl, paddingTop: space.lg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  recent: { flex: 1, gap: space.md, paddingHorizontal: space.xl, paddingTop: space.xl },
  recentList: { gap: space.sm },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
  recentLabel: { flex: 1 },
  list: { paddingHorizontal: space.xl, paddingTop: space.lg },
  listPadding: { paddingHorizontal: space.xl, paddingTop: space.lg },
  group: { gap: space.md, marginBottom: space.xl },
  dayGroup: { gap: space.sm },
  dayHeading: { marginTop: space.xs },
});