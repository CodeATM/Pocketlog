import { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type TextInput } from 'react-native';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import Animated from 'react-native-reanimated';

import {
  Button,
  CategoryPill,
  Chip,
  Collapsible,
  DatePicker,
  DurationPicker,
  Field,
  hasIcon,
  Sheet,
  TapRow,
  Text,
  TimePicker,
} from '@/components/ui';
import { useActivity, useCategories, useTodayActivities } from '@/db/queries';
import { haptics } from '@/lib/haptics';
import { inlineEnter, inlineExit } from '@/lib/motion';
import { useAddActivity } from '@/hooks/useAddActivity';
import { useTodayKey } from '@/hooks/useTodayKey';
import { useUiStore } from '@/stores/uiStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTheme } from '@/theme/context';
import { radius, space } from '@/theme/tokens';
import {
  addMinutes,
  dayKey,
  formatFullDate,
  formatTime,
  fromDayKey,
  minutesBetween,
  suggestDurationFromGap,
} from '@/utils/time';

import {
  MAX_NOTES_LENGTH,
  MAX_TITLE_LENGTH,
  activityDraftFromForm,
  activityFormSchema,
  type ActivityFormValues,
} from './schema';

type Picker = 'date' | 'time' | null;

/** Minutes since local midnight, the unit the form and the repo both speak. */
function minutesSinceMidnight(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function atMinutes(day: string, minutes: number): Date {
  const base = fromDayKey(day);
  if (Number.isNaN(base.getTime())) return new Date();
  return new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    Math.floor(minutes / 60),
    minutes % 60,
    0,
    0,
  );
}

/**
 * The shared add / edit sheet.
 *
 * One component, two modes: identical field order, identical validation, identical
 * save path whether the sheet was opened from the floating button, quick capture, a
 * timeline swipe or the Details screen. An entry therefore cannot be created by
 * rules it could not later be edited by.
 *
 * Optimistic by design — the sheet closes as soon as the write is issued and the
 * timeline re-reads from SQLite on the revision bump. A failed write reopens the
 * sheet with everything still typed and an error above Save, rather than silently
 * dropping the entry.
 *
 * Duration is the centre of gravity: it is the field people most often get wrong,
 * so presets and a stepper remove the keyboard entirely for the common case, and
 * the date/time pickers are native because a hand-rolled wheel would be worse on at
 * least one platform.
 *
 * ```tsx
 * <ActivitySheet />
 * ```
 */
export function ActivitySheet() {
  const { colors, scheme, category, reduceMotion } = useTheme();
  const sheet = useUiStore((state) => state.sheet);
  const closeSheet = useUiStore((state) => state.closeSheet);
  const setHighlight = useUiStore((state) => state.setHighlight);
  const { create, update, remove, defaults } = useAddActivity();

  const isEdit = sheet.kind === 'edit';
  const editId = sheet.kind === 'edit' ? sheet.id : undefined;

  const { data: categories } = useCategories();
  const { data: existing } = useActivity(editId);

  // The shared suggestion list needs today's real entries, and the day key has to be
  // live rather than captured once: the sheet can stay open across midnight.
  const todayKey = useTodayKey();
  const { data: todayRows } = useTodayActivities(todayKey);
  const weekStartsOn = useSettingsStore((state) => state.weekStartsOn);

  const [picker, setPicker] = useState<Picker>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const titleRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const whenTop = useRef(0);

  // The pickers expand in place, below the fold on a tall form. Without this the
  // user taps "Date" and the grid opens off-screen, which reads as a dead tap.
  useEffect(() => {
    if (picker === null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, whenTop.current - space.md), animated: true });
  }, [picker]);

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activityFormSchema),
    defaultValues: {
      title: '',
      categoryId: defaults.categoryId,
      durationMinutes: defaults.durationMinutes,
      startDateKey: todayKey,
      startMinutes: minutesSinceMidnight(new Date()),
      notes: '',
    },
  });

  const { control, handleSubmit, reset, setValue, watch } = form;
  const values = watch();

  const startDate = useMemo(
    () => atMinutes(values.startDateKey, values.startMinutes),
    [values.startDateKey, values.startMinutes],
  );
  const endDate = useMemo(
    () => addMinutes(startDate, values.durationMinutes),
    [startDate, values.durationMinutes],
  );

  /* ------------------------------------------------------------ lifecycle -- */

  // Reset on open so the previous entry's values can never leak into a new one.
  // Edit mode is seeded here too, from the row once it has loaded, which keeps the
  // "open" transition a single code path for both modes.
  const seededRef = useRef<string | null>(null);

  useEffect(() => {
    if (sheet.kind === 'closed') {
      seededRef.current = null;
      setPicker(null);
      setNotesOpen(false);
      setSaveError(null);
      return;
    }

    if (sheet.kind === 'create') {
      const startedAt = sheet.startedAt ?? new Date();
      seededRef.current = 'create';
      reset({
        title: '',
        categoryId: sheet.categoryId ?? defaults.categoryId,
        durationMinutes: defaults.durationMinutes,
        startDateKey: dayKey(startedAt),
        startMinutes: minutesSinceMidnight(startedAt),
        notes: '',
      });
      // Autofocus only on create: on edit the title is not what you came to change.
      const timer = setTimeout(() => titleRef.current?.focus(), 380);
      return () => clearTimeout(timer);
    }

    if (sheet.kind === 'edit' && existing && seededRef.current !== sheet.id) {
      seededRef.current = sheet.id;
      const startedAt = new Date(existing.startedAt);
      reset({
        title: existing.title,
        categoryId: existing.categoryId,
        durationMinutes: existing.durationMinutes,
        startDateKey: dayKey(startedAt),
        startMinutes: minutesSinceMidnight(startedAt),
        notes: existing.notes ?? '',
      });
      setNotesOpen((existing.notes?.length ?? 0) > 0);
    }

    return undefined;
  }, [sheet, existing, reset, defaults.categoryId, defaults.durationMinutes]);

  // A sheet reused for a second create must re-arm the suggestion. Declared *before*
  // the suggestion effect on purpose: effects run in declaration order, so the flag is
  // already clear when the suggestion looks at it. Declared after, the reset would
  // undo a suggestion made in the same commit.
  const suggestedRef = useRef(false);
  useEffect(() => {
    suggestedRef.current = false;
  }, [sheet.kind]);

  // Suggests a duration from the gap before the chosen start time — once, on
  // create, and only when the chosen day is today. Logging right after something
  // else should not mean typing the number that is already on the clock.
  useEffect(() => {
    if (sheet.kind !== 'create' || suggestedRef.current) return;
    if (values.startDateKey !== todayKey) return;

    const previous = todayRows?.[todayRows.length - 1];
    if (!previous) return;

    const gap = minutesBetween(
      addMinutes(new Date(previous.startedAt), previous.durationMinutes),
      atMinutes(values.startDateKey, values.startMinutes),
    );
    const suggestion = suggestDurationFromGap(gap);
    if (!suggestion || suggestion === values.durationMinutes) return;

    suggestedRef.current = true;
    setValue('durationMinutes', suggestion);
  }, [
    sheet.kind,
    todayKey,
    todayRows,
    values.startDateKey,
    values.startMinutes,
    values.durationMinutes,
    setValue,
  ]);

  /* ---------------------------------------------------------------- submit -- */

  const onSubmit = handleSubmit(async (formValues) => {
    setSaving(true);
    setSaveError(null);

    try {
      const saved =
        isEdit && editId
          ? await update(editId, activityDraftFromForm(formValues))
          : await create(activityDraftFromForm(formValues));
      closeSheet();
      setHighlight(saved.id);
    } catch (error) {
      // Keep the sheet open with the values intact.
      setSaveError(error instanceof Error ? error.message : 'That could not be saved.');
      setSaving(false);
    }
  });

  const onDelete = () => {
    if (!existing) return;
    closeSheet();
    void remove(existing);
  };

  return (
    <Sheet
      visible={sheet.kind !== 'closed'}
      onClose={closeSheet}
      title={isEdit ? 'Edit activity' : 'New activity'}
      heightRatio={0.9}
      scrollRef={scrollRef}
      footer={
        <>
          {saveError ? (
            <Text variant="caption" tone="danger" align="center">
              {saveError}
            </Text>
          ) : null}
          <Button
            label={isEdit ? 'Save changes' : 'Save activity'}
            onPress={onSubmit}
            size="lg"
            fullWidth
            loading={saving}
            disabled={values.title.trim().length === 0}
          />
          {isEdit ? (
            <Button
              label="Delete activity"
              variant="destructive"
              onPress={onDelete}
              fullWidth
              icon="trash"
            />
          ) : null}
        </>
      }
    >
      <Controller
        control={control}
        name="title"
        render={({ field }) => (
          <Field
            ref={titleRef}
            label="What did you do?"
            size="lg"
            placeholder="Morning run"
            maxLength={MAX_TITLE_LENGTH}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            error={form.formState.errors.title?.message}
            autoCapitalize="sentences"
            returnKeyType="next"
          />
        )}
      />

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="caption" tone="faint">
          Category
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.chipRow}
        >
          {(categories ?? []).map((row) => (
            <Chip
              key={row.id}
              label={row.name}
              icon={hasIcon(row.icon) ? row.icon : undefined}
              palette={category(row.id, scheme === 'dark' ? row.colorDark : row.colorLight)}
              selected={values.categoryId === row.id}
              onPress={() => {
                haptics.selection();
                setValue('categoryId', row.id, { shouldValidate: true });
              }}
            />
          ))}
        </ScrollView>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="caption" tone="faint">
          Duration
        </Text>
        <Controller
          control={control}
          name="durationMinutes"
          render={({ field }) => (
            <DurationPicker
              minutes={field.value}
              onChange={(next) => {
                haptics.selection();
                field.onChange(next);
              }}
            />
          )}
        />
      </View>

      <View
        style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
        onLayout={(event) => {
          // Direct child of the scroll content, so `y` is the scroll offset that
          // brings the When card — and any picker expanded inside it — into view.
          whenTop.current = event.nativeEvent.layout.y;
        }}
      >
        <Text variant="caption" tone="faint">
          When
        </Text>
        <View style={[styles.well, { backgroundColor: colors.surfaceSunken }]}>
          <TapRow
            inset
            label="Date"
            icon="calendar"
            value={formatFullDate(startDate)}
            onPress={() => setPicker((open) => (open === 'date' ? null : 'date'))}
            accessibilityHint="Opens the date picker."
          />

          {picker === 'date' ? (
            <Animated.View
              entering={inlineEnter(reduceMotion)}
              exiting={inlineExit(reduceMotion)}
              style={styles.pickerSlot}
            >
              <DatePicker
                value={values.startDateKey}
                onChange={(key) => setValue('startDateKey', key, { shouldValidate: true })}
                weekStartsOn={weekStartsOn}
                maxKey={todayKey}
              />
            </Animated.View>
          ) : null}

          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          <TapRow
            inset
            label="Start"
            icon="clock"
            value={formatTime(startDate)}
            trailingNote={`until ${formatTime(endDate)}`}
            onPress={() => setPicker((open) => (open === 'time' ? null : 'time'))}
            accessibilityHint="Opens the time picker."
          />

          {picker === 'time' ? (
            <Animated.View
              entering={inlineEnter(reduceMotion)}
              exiting={inlineExit(reduceMotion)}
              style={styles.pickerSlot}
            >
              <TimePicker
                value={values.startMinutes}
                onChange={(next) => setValue('startMinutes', next, { shouldValidate: true })}
                maxMinutes={minutesSinceMidnight(new Date())}
              />
            </Animated.View>
          ) : null}
        </View>
      </View>

      <Collapsible
        title={notesOpen ? 'Note' : 'Add a note'}
        icon={notesOpen ? 'chevron-down' : 'plus'}
        open={notesOpen}
        onToggle={() => {
          setNotesOpen((open) => !open);
          haptics.light();
        }}
      >
        <Controller
          control={control}
          name="notes"
          render={({ field }) => (
            <Field
              placeholder="What happened? What did you decide?"
              maxLength={MAX_NOTES_LENGTH}
              value={field.value ?? ''}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              error={form.formState.errors.notes?.message}
              multiline
              hint="Only you will ever read this."
            />
          )}
        />
      </Collapsible>

      {existing ? (
        <View style={[styles.meta, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <CategoryPill
            label={existing.category.name}
            glyph={existing.category.icon}
            palette={category(
              existing.category.id,
              scheme === 'dark' ? existing.category.colorDark : existing.category.colorLight,
            )}
          />
          <Text variant="caption" tone="faint">
            Logged {formatFullDate(new Date(existing.createdAt))}
          </Text>
        </View>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipRow: { gap: space.sm, paddingRight: space.sm },
  well: { borderRadius: radius.md, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: space.lg + 20 + space.md },
  // The picker sits flush under its own row, inside the well, so it reads as part of
  // that control rather than as a separate section at the bottom of the card.
  pickerSlot: { paddingBottom: space.md, paddingHorizontal: space.md },
  meta: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
});