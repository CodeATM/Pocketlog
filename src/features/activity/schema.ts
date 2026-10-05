import { z } from 'zod';

/**
 * The one activity schema.
 *
 * The form and the repository share it, so a validation rule cannot exist in one
 * place and be missing from the other: the sheet's inline errors, the import
 * validator and the database write are all reading the same definition.
 */

export const MAX_TITLE_LENGTH = 80;
export const MAX_NOTES_LENGTH = 600;

export const activityFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Give it a name so you can find it later.')
    .max(MAX_TITLE_LENGTH, `Keep it under ${MAX_TITLE_LENGTH} characters.`),
  categoryId: z.string().min(1, 'Pick a category.'),
  /** Minutes as a whole number; the picker only ever produces multiples of 5. */
  durationMinutes: z
    .number()
    .int('Use whole minutes.')
    .min(1, 'A minute at least.')
    .max(24 * 60, 'That is more than a day.'),
  /** Local wall-clock time, not an instant — a time picker returns one. */
  startDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'),
  startMinutes: z.number().int().min(0).max(24 * 60 - 1, 'Pick a time.'),
  notes: z.string().max(MAX_NOTES_LENGTH, 'That note is getting long.').optional(),
});

export type ActivityFormValues = z.infer<typeof activityFormSchema>;

/** The fields the repository actually takes, derived from the validated form. */
export const activityDraftFromForm = (values: ActivityFormValues) => {
  const [year, month, day] = values.startDateKey.split('-').map(Number);
  const startedAt = new Date(
    year ?? 1970,
    (month ?? 1) - 1,
    day ?? 1,
    Math.floor(values.startMinutes / 60),
    values.startMinutes % 60,
    0,
    0,
  );

  return {
    title: values.title.trim(),
    categoryId: values.categoryId,
    startedAt,
    durationMinutes: values.durationMinutes,
    notes: values.notes?.trim() ? values.notes.trim() : null,
  };
};

/** Field-level messages, keyed the way React Hook Form's `errors` object is. */
export type FieldErrors = Partial<Record<keyof ActivityFormValues, string>>;

export function collectErrors(result: {
  success: boolean;
  error?: { flatten?: () => { fieldErrors: Record<string, string[] | undefined> } };
}): FieldErrors {
  if (result.success || !result.error?.flatten) return {};
  const { fieldErrors } = result.error.flatten();
  const entries = Object.entries(fieldErrors);
  if (entries.length === 0) return {};
  return Object.fromEntries(
    entries.map(([key, messages]) => [key, messages?.[0] ?? 'Check this field.']),
  ) as FieldErrors;
}