import type { SQLiteDatabase } from 'expo-sqlite';
import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { z } from 'zod';

import { runMutation } from '@/stores/dbStore';
import { DAY_KEY_PATTERN } from '@/utils/time';

import * as activitiesRepo from './activitiesRepo';
import * as categoriesRepo from './categoriesRepo';

/**
 * Versioned JSON envelope.
 *
 * `formatVersion` is separate from the schema migration number: it describes the
 * shape of an *export file*, which can be read long after the app has moved on.
 * Import rejects anything it does not recognise rather than guessing.
 */
export const EXPORT_FORMAT = 'pocketlog.export';
export const EXPORT_VERSION = 1;

const isoString = z.string().refine((value) => !Number.isNaN(Date.parse(value)), {
  message: 'Expected an ISO-8601 date string',
});

const ActivitySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  categoryId: z.string().min(1),
  notes: z.string().nullable(),
  startedAt: isoString,
  day: z.string().regex(DAY_KEY_PATTERN),
  durationMinutes: z.number().int().positive(),
  createdAt: isoString,
  updatedAt: isoString,
});

export const ExportSchema = z.object({
  format: z.literal(EXPORT_FORMAT),
  version: z.number().int().positive(),
  exportedAt: isoString,
  categories: z.array(z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    icon: z.string().min(1),
    colorLight: z.string().min(1),
    colorDark: z.string().min(1),
    sortOrder: z.number().int(),
  })),
  activities: z.array(ActivitySchema),
});

export type ExportPayload = z.infer<typeof ExportSchema>;

export async function buildExport(db: SQLiteDatabase): Promise<ExportPayload> {
  const [categories, activities] = await Promise.all([
    categoriesRepo.listAll(db),
    activitiesRepo.listAll(db),
  ]);

  return {
    format: EXPORT_FORMAT,
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      icon: category.icon,
      colorLight: category.colorLight,
      colorDark: category.colorDark,
      sortOrder: category.sortOrder,
    })),
    activities,
  };
}

/**
 * Writes the export to the cache directory and hands it to the system share sheet.
 * The cache is the right home: the file is a temporary hand-off, and the OS may
 * reclaim it once sharing finishes.
 */
export async function exportToFile(db: SQLiteDatabase): Promise<string> {
  const payload = await buildExport(db);
  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(Paths.cache, `pocketlog-export-${stamp}.json`);

  if (file.exists) file.delete();
  file.create();
  file.write(JSON.stringify(payload, null, 2));

  if (!(await Sharing.isAvailableAsync())) {
    // Nothing to share with (e.g. a simulator without a share target); leaving the
    // file on disk is more useful than failing the action.
    return file.uri;
  }

  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    dialogTitle: 'Export PocketLog data',
    UTI: 'public.json',
  });

  return file.uri;
}

export type ImportResult =
  | { status: 'cancelled' }
  | { status: 'invalid'; reason: string }
  | { status: 'ok'; activityCount: number };

/**
 * Picks a JSON file, validates it, and replaces the activity table.
 *
 * Import is destructive by design — it restores a backup rather than merging —
 * which is why every caller routes it through a confirmation.
 */
export async function importFromFile(db: SQLiteDatabase): Promise<ImportResult> {
  const picked = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    // SDK 57 renamed this option from `mimeTypes` to `type`. Some file providers
    // report JSON as octet-stream, so the catch-all is kept alongside it.
    type: ['application/json', 'text/plain', '*/*'],
    multiple: false,
  });

  if (picked.canceled) return { status: 'cancelled' };

  const asset = picked.assets?.[0];
  if (!asset) return { status: 'cancelled' };

  let raw: string;
  try {
    raw = await new File(asset.uri).text();
  } catch {
    return { status: 'invalid', reason: 'That file could not be read.' };
  }

  return applyImportText(db, raw);
}

/** Exposed separately so the parsing rules are testable without a file picker. */
export async function applyImportText(db: SQLiteDatabase, raw: string): Promise<ImportResult> {
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    return { status: 'invalid', reason: 'That file is not valid JSON.' };
  }

  const result = ExportSchema.safeParse(parsedJson);
  if (!result.success) {
    return { status: 'invalid', reason: 'That file is not a PocketLog export.' };
  }

  // Through `runMutation`, not a bare write: an import replaces the whole table, so
  // every mounted query has to re-read or the screen keeps showing the previous
  // contents until it is remounted.
  await runMutation(() => activitiesRepo.replaceAll(db, result.data.activities));
  return { status: 'ok', activityCount: result.data.activities.length };
}