import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import {
  Button,
  Card,
  Chip,
  DURATION_PRESETS,
  Eyebrow,
  ListRow,
  SectionHeader,
  SegmentedControl,
  Sheet,
  Text,
  hasIcon,
} from '@/components/ui';
import { exportToFile, importFromFile } from '@/db/backup';
import * as activitiesRepo from '@/db/activitiesRepo';
import { useActivityCount, useCategories } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { runMutation } from '@/stores/dbStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useUiStore } from '@/stores/uiStore';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import { formatDuration } from '@/utils/time';

/**
 * One labelled control inside a grouped card.
 *
 * A settings screen is mostly this shape: a name, a sentence explaining what the
 * choice does, and a control that has to take the full width of the card. `ListRow`
 * cannot do it, because a three-segment control has nowhere to go in a trailing slot
 * — the overflow that produced it was the reason the control was moved out of the row
 * in the first place.
 */
function ControlGroup({
  label,
  description,
  divided,
  children,
}: {
  label: string;
  description?: string;
  divided?: boolean;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.group,
        divided ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
      ]}
    >
      <View style={styles.groupHead}>
        <Text variant="headline">{label}</Text>
        {description ? (
          <Text variant="caption" tone="muted">
            {description}
          </Text>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Settings.
 *
 * Grouped by how often it changes: appearance and logging defaults at the top, data
 * at the bottom. Everything is immediate — there is no Save button, because a
 * settings screen with a Save button is a form, and these are preferences, not a
 * document.
 *
 * **Cards, not stacked controls.** The earlier version floated each control directly
 * on the page behind a small caps label, which made the screen read as a stack of
 * unrelated widgets with no sense of belonging to the app. Every group now sits in a
 * card with the same hairline edge and one-step surface as a timeline entry, so the
 * screen is made of the same material as the rest of PocketLog and the eye reads the
 * grouping before it reads the labels.
 *
 * The controls themselves stay exactly where the layout forced them to be — full
 * width inside the card — because that is the one arrangement a segmented control
 * does not overflow in.
 *
 * Import is destructive and therefore the only control here with a confirmation: it
 * replaces the entire activity table. Export is not, because it only reads.
 *
 * ```tsx
 * <SettingsScreen />
 * ```
 */
export default function SettingsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { colors, scheme, category } = useTheme();
  const insets = useSafeAreaInsets();

  const settings = useSettingsStore();
  const { data: categories } = useCategories();
  const { data: activityCount } = useActivityCount();
  const openCreate = useUiStore((state) => state.openCreate);

  const [importSheet, setImportSheet] = useState(false);
  const [clearSheet, setClearSheet] = useState(false);
  const [busy, setBusy] = useState<'export' | 'import' | 'clear' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const runExport = async () => {
    setBusy('export');
    setMessage(null);
    try {
      const uri = await exportToFile(db);
      setMessage(`Exported to ${uri.split('/').pop() ?? 'file'}.`);
    } catch {
      setMessage('Export failed.');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    setBusy('import');
    setMessage(null);
    try {
      const result = await importFromFile(db);
      if (result.status === 'ok') {
        setImportSheet(false);
        setMessage(`Imported ${result.activityCount} entries.`);
      } else if (result.status === 'invalid') {
        setMessage(result.reason);
      }
    } catch {
      setMessage('Import failed.');
    } finally {
      setBusy(null);
    }
  };

  const runClear = async () => {
    setBusy('clear');
    try {
      // Through `runMutation`, so every screen re-reads: a bare `deleteAll` would
      // leave the Today timeline and the Insights totals showing entries that are
      // already gone until the app is restarted.
      await runMutation(() => activitiesRepo.deleteAll(db));
      setClearSheet(false);
      setMessage('All activities deleted. Your preferences are untouched.');
    } catch {
      setMessage('Could not delete your activities.');
    } finally {
      setBusy(null);
    }
  };

  const entryCount = activityCount ?? 0;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      <View style={styles.nav}>
        <Button label="Back" icon="arrow-left" variant="ghost" onPress={() => router.back()} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space.huge }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Eyebrow tone="accent">Settings</Eyebrow>
          <Text variant="display">Make it yours</Text>
          <Text variant="body" tone="muted" style={styles.heroBody}>
            Changes apply the moment you make them. {entryCount}{' '}
            {entryCount === 1 ? 'entry' : 'entries'} logged so far, all of it on this
            device.
          </Text>
        </View>

        {message ? (
          <View
            style={[
              styles.message,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
          >
            <Text variant="caption" tone="muted">
              {message}
            </Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <SectionHeader title="Appearance" />
          <Card padded={false}>
            <ControlGroup
              label="Theme"
              description="Follows the system until you choose one."
            >
              <SegmentedControl
                block
                value={settings.themeMode}
                onChange={(value) => {
                  haptics.selection();
                  settings.setThemeMode(value);
                }}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                  { value: 'dark', label: 'Dark' },
                ]}
              />
            </ControlGroup>

            <ControlGroup
              label="Motion"
              description="Animations across the app, sheets and pickers."
              divided
            >
              <SegmentedControl
                block
                value={settings.motion}
                onChange={(value) => {
                  haptics.selection();
                  settings.setMotion(value);
                }}
                options={[
                  { value: 'system', label: 'System' },
                  { value: 'always', label: 'Animate' },
                  { value: 'never', label: 'Reduce' },
                ]}
              />
            </ControlGroup>

            <ControlGroup
              label="Week starts"
              description="Used by the calendar grid and the insights axis."
              divided
            >
              <SegmentedControl
                block
                value={settings.weekStartsOn === 1 ? 'monday' : 'sunday'}
                onChange={(value) => {
                  haptics.selection();
                  settings.setWeekStartsOn(value === 'monday' ? 1 : 0);
                }}
                options={[
                  { value: 'monday', label: 'Monday' },
                  { value: 'sunday', label: 'Sunday' },
                ]}
              />
            </ControlGroup>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Logging" />
          <Card padded={false}>
            <ControlGroup
              label="Default category"
              description="Pre-selected when you log something new."
            >
              <View style={styles.chips}>
                {(categories ?? []).map((row) => (
                  <Chip
                    key={row.id}
                    label={row.name}
                    icon={hasIcon(row.icon) ? row.icon : undefined}
                    palette={category(row.id, scheme === 'dark' ? row.colorDark : row.colorLight)}
                    selected={settings.defaultCategoryId === row.id}
                    onPress={() => {
                      haptics.selection();
                      settings.setDefaultCategoryId(row.id);
                    }}
                  />
                ))}
              </View>
            </ControlGroup>

            <ControlGroup
              label="Default duration"
              description="Starts the add sheet here, so the common case is one tap."
              divided
            >
              <View style={styles.chips}>
                {DURATION_PRESETS.map((minutes) => (
                  <Chip
                    key={minutes}
                    label={formatDuration(minutes)}
                    selected={settings.defaultDurationMinutes === minutes}
                    onPress={() => {
                      haptics.selection();
                      settings.setDefaultDurationMinutes(minutes);
                    }}
                  />
                ))}
              </View>
            </ControlGroup>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionHeader title="Your data" />
          <Card padded={false}>
            <ListRow
              title="Log an activity"
              icon="plus"
              accessibilityHint="Opens the add sheet."
              navigable
              onPress={() => {
                router.back();
                openCreate();
              }}
            />
            <ListRow
              title="Export"
              subtitle={`${entryCount} ${entryCount === 1 ? 'entry' : 'entries'} as JSON`}
              icon="export"
              onPress={() => void runExport()}
              disabled={busy !== null}
            />
            <ListRow
              title="Import"
              subtitle="Replaces everything currently logged"
              icon="import"
              onPress={() => setImportSheet(true)}
              disabled={busy !== null}
            />
            <ListRow
              title="Delete all activities"
              icon="trash"
              tone="danger"
              divided={false}
              onPress={() => setClearSheet(true)}
            />
          </Card>
        </View>

        <View style={[styles.privacy, { borderColor: colors.border }]}>
          <Text variant="caption" tone="faint" align="center">
            PocketLog keeps everything on this device. No account, no network, no
            telemetry.
          </Text>
        </View>
      </ScrollView>

      <Sheet
        visible={importSheet}
        onClose={() => setImportSheet(false)}
        title="Replace all data?"
        scrollable={false}
        heightRatio={0.42}
        footer={
          <>
            <Button
              label="Choose a file"
              onPress={() => void runImport()}
              loading={busy === 'import'}
              fullWidth
            />
            <Button label="Cancel" variant="ghost" onPress={() => setImportSheet(false)} fullWidth />
          </>
        }
      >
        <Text variant="body" tone="muted">
          Importing replaces every logged entry with the contents of the file. Export
          first if you want to keep what is here.
        </Text>
      </Sheet>

      <Sheet
        visible={clearSheet}
        onClose={() => setClearSheet(false)}
        title="Delete everything?"
        scrollable={false}
        heightRatio={0.42}
        dismissible={false}
        footer={
          <>
            <Button
              label="Delete all activities"
              variant="destructive"
              onPress={() => void runClear()}
              fullWidth
            />
            <Button label="Keep them" variant="ghost" onPress={() => setClearSheet(false)} fullWidth />
          </>
        }
      >
        <Text variant="body" tone="muted">
          This removes every entry and cannot be undone. Your categories and
          preferences stay.
        </Text>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    paddingTop: space.lg,
  },
  content: { gap: space.xl, paddingHorizontal: space.xl, paddingTop: space.sm },

  hero: { gap: space.sm },
  heroBody: { maxWidth: 460 },

  section: { gap: space.md },
  group: { gap: space.md, padding: space.lg },
  groupHead: { gap: 2 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },

  privacy: {
    paddingTop: space.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  message: {
    padding: space.md,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
  },
});