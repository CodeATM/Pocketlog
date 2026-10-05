import { useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Eyebrow,
  ListRow,
  SectionHeader,
  Text,
} from '@/components/ui';
import { useActivity } from '@/db/queries';
import { useAddActivity } from '@/hooks/useAddActivity';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import {
  addMinutes,
  formatDayHeading,
  formatDurationSpaced,
  formatTime,
  spokenDuration,
} from '@/utils/time';

/** Hour marks drawn under the day track. */
const TRACK_TICKS = [0, 6, 12, 18, 24] as const;
const MINUTES_PER_DAY = 24 * 60;

/**
 * Where the block sat in the day, as a proportion of the whole 24 hours.
 *
 * A start/end pair drawn to scale is worth a row of metadata on its own: it answers
 * "when in my day was this" at a glance, which a table of numbers cannot. The block
 * keeps a floor on its width so a twenty-minute entry still reads as a mark rather
 * than a hairline, and is clamped so an entry running past midnight cannot spill
 * out of the track.
 */
function DayTrack({
  start,
  durationMinutes,
  solid,
  tint,
  track,
  border,
  faint,
}: {
  start: Date;
  durationMinutes: number;
  solid: string;
  tint: string;
  track: string;
  border: string;
  faint: string;
}) {
  const { left, width } = useMemo(() => {
    const from = start.getHours() * 60 + start.getMinutes();
    const startPct = Math.min(99, Math.max(0, (from / MINUTES_PER_DAY) * 100));
    const raw = (durationMinutes / MINUTES_PER_DAY) * 100;
    // Floor so a twenty-minute entry still reads as a mark rather than a hairline,
    // and clamp so a block running past midnight cannot spill out of the track.
    return { left: startPct, width: Math.min(100 - startPct, Math.max(1.5, raw)) };
  }, [start, durationMinutes]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`From ${formatTime(start)} for ${spokenDuration(durationMinutes)}`}
      style={styles.trackWrap}
    >
      <View style={[styles.track, { backgroundColor: track, borderColor: border }]}>
        <View
          style={[
            styles.block,
            { left: `${left}%`, width: `${width}%`, backgroundColor: solid, borderColor: border },
          ]}
        >
          <View style={[styles.blockHalo, { backgroundColor: tint }]} />
        </View>
      </View>

      <View style={styles.ticks}>
        {TRACK_TICKS.map((hour) => (
          <Text key={hour} variant="axisLabel" tone="faint" style={styles.tick}>
            {hour === 0 || hour === 24 ? '12a' : hour === 12 ? '12p' : hour < 12 ? `${hour}a` : `${hour - 12}p`}
          </Text>
        ))}
      </View>
    </View>
  );
}

/**
 * Activity details.
 *
 * Built as a page rather than a form: the title is the headline, and everything
 * else is arranged to answer three questions in the order they get asked — *how
 * long was it*, *when in my day*, *what else do I know about it*. The day track
 * carries the middle one in a single glance.
 *
 * The metadata is a labelled table rather than a wall of rows, and a note is set
 * as a pull quote with a rule in the category's colour, because a note is the one
 * part of an entry that is the user's own words and should not look like another
 * form field.
 *
 * Delete is undoable rather than confirmed — the same snackbar the timeline raises,
 * mounted at the root, so a restore brings back the original id and its position.
 * It sits beside Edit rather than spanning the width on its own: a full-width red
 * slab invited the tap it was meant to prevent. The screen is closed first so the
 * user lands on the timeline and can see the undo land there.
 *
 * ```tsx
 * <Redirect href="/activity/abc123" />
 * ```
 */
export default function ActivityDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, scheme, category } = useTheme();
  const { openEdit, remove } = useAddActivity();

  const { data: activity, isLoading, error, refresh } = useActivity(id);

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <Text variant="body" tone="faint">
          Loading…
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <ErrorState
          title="Could not open this"
          message={error instanceof Error ? error.message : 'Try again.'}
          onRetry={refresh}
        />
      </View>
    );
  }

  if (!activity) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        <EmptyState
          icon="info"
          title="This entry is gone"
          message="It may have been deleted, or the link is stale."
          action={<Button label="Go back" onPress={() => router.back()} variant="secondary" />}
        />
      </View>
    );
  }

  const startedAt = new Date(activity.startedAt);
  const endedAt = addMinutes(startedAt, activity.durationMinutes);
  const palette = category(
    activity.category.id,
    scheme === 'dark' ? activity.category.colorDark : activity.category.colorLight,
  );

  const whenRows = [
    { label: 'Date', value: formatDayHeading(activity.day), icon: 'calendar' as const },
    { label: 'Started', value: formatTime(startedAt), icon: 'clock' as const },
    { label: 'Ended', value: formatTime(endedAt), icon: 'check' as const },
  ];

  const recordRows = [
    {
      label: 'Logged',
      value: formatDayHeading(dayKeyOf(new Date(activity.createdAt))),
      icon: 'edit' as const,
    },
    {
      label: 'Category',
      value: activity.category.name,
      icon: 'shapes' as const,
    },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Button label="Back" icon="arrow-left" variant="ghost" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Eyebrow tone="muted">{activity.category.name}</Eyebrow>
          <Text variant="display">{activity.title}</Text>
        </View>

        <View
          accessible
          accessibilityRole="text"
          accessibilityLabel={spokenDuration(activity.durationMinutes)}
          style={styles.figure}
        >
          <Text variant="numericLarge" style={styles.figureValue}>
            {formatDurationSpaced(activity.durationMinutes)}
          </Text>
        </View>

        <View style={styles.trackCard}>
          <DayTrack
            start={startedAt}
            durationMinutes={activity.durationMinutes}
            solid={palette.solid}
            tint={palette.tint}
            track={colors.surfaceSunken}
            border={colors.border}
            faint={colors.textFaint}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader title="When" />
          <Card padded={false}>
            {whenRows.map((row, index) => (
              <ListRow
                key={row.label}
                title={row.label}
                value={row.value}
                icon={row.icon}
                divided={index < whenRows.length - 1}
              />
            ))}
          </Card>
        </View>

        {activity.notes ? (
          <View style={styles.section}>
            <SectionHeader title="Note" />
            <View style={[styles.quote, { borderLeftColor: palette.solid }]}>
              <Text variant="body">{activity.notes}</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Record" />
          <Card padded={false}>
            {recordRows.map((row, index) => (
              <ListRow
                key={row.label}
                title={row.label}
                value={row.value}
                icon={row.icon}
                divided={index < recordRows.length - 1}
              />
            ))}
          </Card>
        </View>

        <View style={styles.actions}>
          <View style={styles.action}>
            <Button label="Edit activity" icon="edit" fullWidth onPress={() => openEdit(activity.id)} />
          </View>
          <View style={styles.action}>
            <Button
              label="Delete"
              variant="secondary"
              icon="trash"
              fullWidth
              onPress={() => {
                router.back();
                void remove(activity);
              }}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

/** `formatDayHeading` wants a day key; the created timestamp is a full date. */
function dayKeyOf(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
  },
  content: { gap: space.xl, paddingHorizontal: space.xl, paddingBottom: space.huge },

  hero: { gap: space.sm },
  figure: { gap: 2 },
  figureValue: { letterSpacing: -1 },

  trackCard: {
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  trackWrap: { gap: space.sm },
  track: {
    height: 34,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  block: {
    position: 'absolute',
    top: 6,
    bottom: 6,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  blockHalo: { flex: 1, opacity: 0.35 },
  ticks: { flexDirection: 'row', justifyContent: 'space-between' },
  tick: { flex: 1, textAlign: 'center' },

  section: { gap: space.md },
  quote: {
    paddingLeft: space.lg,
    paddingVertical: space.xs,
    borderLeftWidth: 3,
  },

  actions: { flexDirection: 'row', gap: space.md },
  action: { flex: 1 },
});