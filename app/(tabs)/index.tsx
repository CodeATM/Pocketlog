import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  Icon,
  IconButton,
  SkeletonTimeline,
  SummaryStrip,
  Text,
  TimelineGap,
  TimelineRow,
  type TimelineItem,
} from '@/components/ui';
import { useTodayActivities } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { useAddActivity } from '@/hooks/useAddActivity';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useUiStore } from '@/stores/uiStore';
import { useTheme } from '@/theme/context';
import { radius, shadows, space } from '@/theme/tokens';
import {
  addMinutes,
  formatDayMonth,
  formatWeekday,
  minutesBetween,
} from '@/utils/time';

/**
 * Today.
 *
 * The editorial header is the screen: the weekday, the date and the total sit above
 * the fold at display sizes, and the timeline begins below a hairline rule. The
 * summary strip is typographic rather than graphical — one big counted numeral, one
 * caption, one eight-pixel segmented bar — so the screen has exactly one focal point.
 *
 * Two affordances, both reachable without scrolling:
 *
 * - The **floating add button**, one of only two places in the app allowed a shadow,
 *   since it is the one thing that must be findable without being looked for.
 * - **Quick capture**, a single-line field that appears when you tap the plus on the
 *   header: title only, default category, default duration, now. It exists because
 *   most logging is "I just did a thing for about half an hour", and that should take
 *   one tap and one line rather than the full sheet.
 *
 * Gaps between entries are rendered as `TimelineGap` rather than invented zero-length
 * activities, so the day shows honestly what was not logged.
 *
 * ```tsx
 * <TodayScreen />
 * ```
 */
export default function TodayScreen() {
  const router = useRouter();
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();
  const { openCreate, openEdit, remove, quickCapture, defaults } = useAddActivity();
  const highlightId = useUiStore((state) => state.highlightId);
  const setHighlight = useUiStore((state) => state.setHighlight);

  const today = useTodayKey();
  const { data: rows, isLoading, error, refresh } = useTodayActivities(today);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickText, setQuickText] = useState('');
  const [quickBusy, setQuickBusy] = useState(false);

  // `rows` is undefined while loading, but the rest of the screen treats the list as
  // always-present so the empty/loading branches can be a single check on length.
  const activities = useMemo(() => rows ?? [], [rows]);

  const minutes = useMemo(
    () => activities.reduce((total, activity) => total + activity.durationMinutes, 0),
    [activities],
  );

  /**
   * Longest block on the screen, so the rows' duration bars can be drawn against a
   * common scale and read as the shape of the day. Floored so a day of only short
   * entries does not fill every bar.
   */
  const longestBlock = useMemo(
    () =>
      Math.max(
        30,
        activities.reduce((longest, activity) => Math.max(longest, activity.durationMinutes), 0),
      ),
    [activities],
  );

  const segments = useMemo(() => {
    const totals = new Map<string, number>();
    for (const activity of activities) {
      totals.set(activity.categoryId, (totals.get(activity.categoryId) ?? 0) + activity.durationMinutes);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id, categoryMinutes]) => ({
        id,
        minutes: categoryMinutes,
        palette: category(id),
      }));
  }, [activities, category]);

  /** Timeline rows plus the gaps between them, flattened into one render list. */
  const items = useMemo(() => {
    const output: ({ kind: 'gap'; key: string; minutes: number } | { kind: 'row'; key: string; item: TimelineItem })[] = [];

    activities.forEach((activity, index) => {
      const startedAt = new Date(activity.startedAt);
      const previous = index > 0 ? activities[index - 1] : undefined;

      if (previous) {
        const previousEnd = addMinutes(new Date(previous.startedAt), previous.durationMinutes);
        const gap = minutesBetween(previousEnd, startedAt);
        if (gap >= 10) {
          output.push({
            kind: 'gap',
            key: `gap-${activity.id}`,
            minutes: gap,
          });
        }
      }

      output.push({
        kind: 'row',
        key: activity.id,
        item: {
          id: activity.id,
          title: activity.title,
          categoryName: activity.category.name,
          glyph: activity.category.icon,
          palette: category(
            activity.category.id,
            scheme === 'dark' ? activity.category.colorDark : activity.category.colorLight,
          ),
          startedAt,
          durationMinutes: activity.durationMinutes,
          notes: activity.notes,
          isFirst: index === 0,
          isLast: index === activities.length - 1,
        },
      });
    });

    return output;
  }, [activities, category, scheme]);

  const submitQuick = useCallback(async () => {
    const trimmed = quickText.trim();
    if (trimmed.length === 0 || quickBusy) return;

    setQuickBusy(true);
    try {
      const created = await quickCapture(trimmed);
      setQuickText('');
      setQuickOpen(false);
      if (created) setHighlight(created.id);
    } finally {
      setQuickBusy(false);
    }
  }, [quickText, quickBusy, quickCapture, setHighlight]);

  const header = (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          <Eyebrow tone="faint">{formatWeekday(new Date())}</Eyebrow>
          <Text variant="displayCompact">{formatDayMonth(new Date())}</Text>
        </View>

        <View style={styles.headerActions}>
          <IconButton
            name="plus"
            label={quickOpen ? 'Close quick capture' : 'Quick capture'}
            tone="accent"
            variant="tonal"
            onPress={() => {
              haptics.light();
              setQuickOpen((open) => !open);
            }}
          />
          <IconButton
            name="settings"
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        </View>
      </View>

      {quickOpen ? (
        <View style={styles.quickRow}>
          <View style={styles.quickField}>
            <Field
              placeholder={`Quick capture — ${defaults.durationMinutes} minutes`}
              value={quickText}
              onChangeText={setQuickText}
              onSubmitEditing={() => void submitQuick()}
              returnKeyType="done"
              autoFocus
              maxLength={80}
            />
          </View>
          <Button
            label="Log"
            onPress={() => void submitQuick()}
            loading={quickBusy}
            disabled={quickText.trim().length === 0}
          />
        </View>
      ) : null}

      <SummaryStrip minutes={minutes} count={activities.length} segments={segments} />
    </View>
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {header}

      {isLoading && activities.length === 0 ? (
        <View style={styles.listPadding}>
          <SkeletonTimeline rows={5} />
        </View>
      ) : error && activities.length === 0 ? (
        <ErrorState
          title="Could not load today"
          message={error instanceof Error ? error.message : 'Try again.'}
          onRetry={refresh}
        />
      ) : activities.length === 0 ? (
        <View style={styles.listPadding}>
          <EmptyState
            icon="clock"
            title="Nothing logged yet today"
            message="Tap Quick capture for something you just did, or use the button below for something with a longer story."
            action={
              <Button label="Log an activity" onPress={() => openCreate()} />
            }
          />
        </View>
      ) : (
        <View style={styles.timeline}>
          {items.map((entry, index) =>
            entry.kind === 'gap' ? (
              <TimelineGap
                key={entry.key}
                minutes={entry.minutes}
                first={index === 0}
                last={index === items.length - 1}
              />
            ) : (
              <TimelineRow
                key={entry.key}
                item={entry.item}
                scaleMaxMinutes={longestBlock}
                highlighted={highlightId === entry.item.id}
                onPress={() => {
                  if (highlightId === entry.item.id) setHighlight(null);
                  router.push(`/activity/${entry.item.id}`);
                }}
                onEdit={() => openEdit(entry.item.id)}
                onDelete={() => {
                  const activity = activities.find((row) => row.id === entry.item.id);
                  if (activity) void remove(activity);
                }}
              />
            ),
          )}
        </View>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Log an activity"
        accessibilityHint="Opens a sheet to add something you did."
        onPress={() => {
          haptics.light();
          openCreate();
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            bottom: insets.bottom + 84,
            backgroundColor: pressed ? colors.accentPressed : colors.accent,
            ...shadows.fab[scheme],
          },
        ]}
      >
        <Icon name="plus" size={24} color={colors.onAccent} strokeWidth={2.25} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: space.xl },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingTop: space.lg },
  headerCopy: { flex: 1, gap: space.xs },
  headerActions: { flexDirection: 'row', gap: space.xs },
  quickRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  quickField: { flex: 1 },
  listPadding: { flex: 1, paddingHorizontal: space.xl },
  // No gap: `TimelineRow` draws its own connector into the space between cards, so a
  // gap here would push the cards twice as far apart as the thread is tall.
  timeline: { flex: 1, paddingHorizontal: space.xl, paddingTop: space.md },
  fab: {
    position: 'absolute',
    right: space.xl,
    alignItems: 'center',
    justifyContent: 'center',
    width: 56,
    height: 56,
    borderRadius: radius.pill,
  },
});