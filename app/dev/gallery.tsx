import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarChart,
  Button,
  Card,
  CategoryPill,
  Chip,
  Collapsible,
  CountUpMinutes,
  CountUpNumber,
  DaySegmentBar,
  DurationPicker,
  EmptyState,
  ErrorState,
  Eyebrow,
  Field,
  Icon,
  IconButton,
  ListRow,
  ProgressBar,
  SectionHeader,
  SegmentedControl,
  Sheet,
  Skeleton,
  SkeletonTimeline,
  Snackbar,
  StatTile,
  SummaryStrip,
  TapRow,
  Text,
  TimelineGap,
  TimelineRow,
  type BarDatum,
  type SummarySegment,
  type TimelineItem,
} from '@/components/ui';
import { useTheme } from '@/theme/context';
import { categorySolids, radius, space } from '@/theme/tokens';

/**
 * Component gallery.
 *
 * Every component in the library, rendered in a scrollable reference rather than
 * buried across five screens. Each section is titled with the component's name and
 * shows the real variants with real props, so what you see here is exactly what a
 * screen will produce — including the states (disabled, selected, error, loading)
 * that are tedious to reach in a real flow.
 *
 * This route deliberately mounts nothing from the database: it has to render even
 * when the schema is broken, which is the whole point of having it.
 *
 * ```tsx
 * <Redirect href="/dev/gallery" />
 * ```
 */

export default function GalleryScreen() {
  const { colors, scheme, category, reduceMotion } = useTheme();
  const insets = useSafeAreaInsets();
  const [sheetOpen, setSheetOpen] = useState(false);

  const solid = (id: string) => categorySolids[scheme][id as keyof typeof categorySolids.light];

  const timelineItem: TimelineItem = {
    id: 'demo',
    title: 'Deep work — export format',
    categoryName: 'Work',
    glyph: 'briefcase',
    palette: category('work', solid('work')),
    startedAt: new Date(2025, 0, 7, 9, 30),
    durationMinutes: 110,
    notes: 'Finished the parser and its tests.',
    isFirst: true,
    isLast: false,
  };

  const segments: SummarySegment = { id: 'work', minutes: 110, palette: category('work', solid('work')) };

  const bars: BarDatum[] = [
    { key: 'a', label: '7', fullLabel: 'Mon 7', totalMinutes: 300, stacks: [{ id: 'work', name: 'Work', color: solid('work'), minutes: 300 }] },
    { key: 'b', label: '8', fullLabel: 'Tue 8', totalMinutes: 180, stacks: [{ id: 'study', name: 'Study', color: solid('study'), minutes: 180 }] },
    { key: 'c', label: '9', fullLabel: 'Wed 9', totalMinutes: 0, stacks: [] },
    { key: 'd', label: '10', fullLabel: 'Thu 10', totalMinutes: 420, stacks: [{ id: 'work', name: 'Work', color: solid('work'), minutes: 420 }], isCurrent: true },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Text variant="title1">Gallery</Text>
        <Eyebrow tone="faint">{scheme}</Eyebrow>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ---------------------------------------------------------- text -- */}
        <Section>
          <Title>Text</Title>
          <Text variant="display">Display</Text>
          <Text variant="title1">Title one</Text>
          <Text variant="title2">Title two</Text>
          <Text variant="headline">Headline</Text>
          <Text variant="body">Body text for reading. It sets the default measure.</Text>
          <Text variant="callout" tone="muted">
            Callout, muted
          </Text>
          <Text variant="caption" tone="faint">
            Caption, faint
          </Text>
          <CountUpMinutes minutes={325} />
          <CountUpNumber value={42} variant="numericSmall" suffix=" entries" animate />
        </Section>

        {/* -------------------------------------------------------- buttons -- */}
        <Section>
          <Title>Button</Title>
          <View style={styles.row}>
            <Button label="Primary" onPress={() => undefined} />
            <Button label="Secondary" variant="secondary" onPress={() => undefined} />
          </View>
          <View style={styles.row}>
            <Button label="Ghost" variant="ghost" onPress={() => undefined} />
            <Button label="Destructive" variant="destructive" onPress={() => undefined} />
          </View>
          <View style={styles.row}>
            <Button label="Disabled" onPress={() => undefined} disabled />
            <Button label="Loading" onPress={() => undefined} loading />
          </View>
          <Button label="With icon" icon="plus" onPress={() => undefined} fullWidth />
        </Section>

        {/* ---------------------------------------------------- icon button -- */}
        <Section>
          <Title>IconButton</Title>
          <View style={styles.row}>
            <IconButton name="settings" label="Settings" />
            <IconButton name="plus" label="Add" tone="accent" variant="tonal" />
            <IconButton name="trash" label="Delete" tone="danger" />
            <IconButton name="edit" label="Disabled" disabled />
          </View>
        </Section>

        {/* ----------------------------------------------------------- chips -- */}
        <Section>
          <Title>Chip</Title>
          <View style={styles.row}>
            <Chip label="Unselected" onPress={() => undefined} />
            <Chip label="Selected" selected onPress={() => undefined} />
            <Chip
              label="Category"
              icon="briefcase"
              palette={category('work', solid('work'))}
              selected
              onPress={() => undefined}
            />
          </View>
          <CategoryPill label="Work" glyph="briefcase" palette={category('work', solid('work'))} />
          <CategoryPill
            label="Work"
            glyph="briefcase"
            palette={category('work', solid('work'))}
            emphasis="solid"
          />
        </Section>

        {/* ------------------------------------------------------- segmented -- */}
        <Section>
          <Title>SegmentedControl</Title>
          <SegmentedControl
            value="light"
            onChange={() => undefined}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Section>

        {/* ----------------------------------------------------------- stats -- */}
        <Section>
          <Title>StatTile</Title>
          <View style={styles.row}>
            <StatTile label="Total" value="5h 25m" />
            <StatTile label="Entries" value="7" />
          </View>
        </Section>

        {/* ------------------------------------------------------- progress -- */}
        <Section>
          <Title>Progress</Title>
          <ProgressBar value={0.62} />
          <DaySegmentBar
            segments={[
              { id: 'work', share: 60, color: solid('work') },
              { id: 'study', share: 30, color: solid('study') },
              { id: 'health', share: 90, color: solid('health') },
            ]}
          />
        </Section>

        {/* -------------------------------------------------------- timeline -- */}
        <Section>
          <Title>TimelineRow</Title>
          <TimelineRow
            item={timelineItem}
            onPress={() => undefined}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
          <TimelineGap minutes={35} />
          <TimelineRow
            item={{ ...timelineItem, id: 'demo-2', title: 'Easy run, five kilometres', isFirst: false, isLast: true }}
            onPress={() => undefined}
            onEdit={() => undefined}
            onDelete={() => undefined}
          />
        </Section>

        {/* --------------------------------------------------------- summary -- */}
        <Section>
          <Title>SummaryStrip</Title>
          <SummaryStrip minutes={325} count={7} segments={[segments]} />
        </Section>

        {/* ----------------------------------------------------------- chart -- */}
        <Section>
          <Title>BarChart</Title>
          <BarChart data={bars} />
        </Section>

        {/* -------------------------------------------------------- duration -- */}
        <Section>
          <Title>DurationPicker</Title>
          <DurationPicker minutes={45} onChange={() => undefined} />
        </Section>

        {/* ----------------------------------------------------------- forms -- */}
        <Section>
          <Title>Field</Title>
          <Field label="With label" placeholder="Placeholder" value="" onChangeText={() => undefined} />
          <Field label="Large" size="lg" placeholder="Activity title" value="" onChangeText={() => undefined} />
          <Field label="With error" error="Pick a category." value="" onChangeText={() => undefined} />
          <Field placeholder="With hint" hint="Only you will ever read this." value="" onChangeText={() => undefined} />
          <Field label="Multiline" multiline placeholder="Notes" value="" onChangeText={() => undefined} />
          <TapRow label="Date" icon="calendar" value="Tuesday, 7 January" onPress={() => undefined} />
          <TapRow
            label="Start"
            icon="clock"
            value="9:30 AM"
            trailingNote="until 11:20 AM"
            onPress={() => undefined}
          />
          <Collapsible title="Add a note" open={false} onToggle={() => undefined}>
            <Field placeholder="Notes" value="" onChangeText={() => undefined} />
          </Collapsible>
        </Section>

        {/* ----------------------------------------------------------- lists -- */}
        <Section>
          <Title>ListRow</Title>
          <Card padded={false}>
            <ListRow title="With subtitle" subtitle="Secondary copy" trailing="Value" />
            <ListRow title="Navigable" icon="settings" navigable onPress={() => undefined} />
            <ListRow title="Destructive" icon="trash" tone="danger" divided={false} onPress={() => undefined} />
          </Card>
        </Section>

        {/* ---------------------------------------------------------- states -- */}
<Section>
          <Title>Skeleton</Title>
          <Skeleton width="60%" height={18} />
          <SkeletonTimeline rows={2} />
          <EmptyState
            icon="search"
            title="Nothing here"
            message="Empty states are typographic by design."
            layout="inline"
          />
          <ErrorState title="Something failed" message="Error states offer a retry." onRetry={() => undefined} />
        </Section>

        {/* ---------------------------------------------------------- snackbar -- */}
        <Section>
          <Title>Snackbar</Title>
          <View style={styles.snackbarHost}>
            <Snackbar
              message="Deleted “Deep work”"
              tone="danger"
              actionLabel="Undo"
              onAction={() => undefined}
              onDismiss={() => undefined}
            />
          </View>
        </Section>

        {/* ------------------------------------------------------------ sheet -- */}
        <Section>
          <Title>Sheet</Title>
          <Button label="Open sheet" onPress={() => setSheetOpen(true)} variant="secondary" />
          <Sheet
            visible={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title="Sheet"
            heightRatio={0.5}
            footer={<Button label="Save" onPress={() => setSheetOpen(false)} fullWidth />}
          >
            <Text variant="body" tone="muted">
              Sheets host forms, confirmations and anything else that should not push
              the screen behind it.
            </Text>
          </Sheet>
        </Section>

        {/* ------------------------------------------------------------ icons -- */}
        <Section>
          <Title>Icons</Title>
          <View style={styles.iconGrid}>
            {(['sun', 'calendar', 'insights', 'search', 'settings', 'plus', 'check', 'trash', 'undo', 'export', 'import', 'palette'] as const).map(
              (name) => (
                <View key={name} style={styles.iconCell}>
                  <Icon name={name} size={22} color={colors.text} />
                  <Text variant="caption" tone="faint">
                    {name}
                  </Text>
                </View>
              ),
            )}
          </View>
        </Section>

        <Text variant="caption" tone="faint" align="center">
          {reduceMotion ? 'Reduced motion is on — transitions are instant.' : 'Transitions are at full motion.'}
        </Text>
      </ScrollView>
    </View>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/**
 * Section label.
 *
 * Delegates to the real `SectionHeader` rather than an ad-hoc eyebrow, so the gallery
 * exercises the same primitive the screens use — a gallery that reimplements a heading
 * is a gallery that can drift.
 */
function Title({ children }: { children: string }) {
  return (
    <View style={styles.sectionTitle}>
      <SectionHeader title={children} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.md,
  },
  content: { paddingHorizontal: space.xl, gap: space.huge },
  section: { gap: space.md },
  sectionTitle: { paddingTop: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  snackbarHost: { height: 72, justifyContent: 'center' },
  iconGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg },
  iconCell: {
    width: 64,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
  },
});