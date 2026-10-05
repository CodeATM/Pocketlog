import { SQLiteProvider, type SQLiteDatabase } from 'expo-sqlite';

import * as categoriesRepo from './categoriesRepo';
import { migrateDb } from './migrations';
import { seedIfEmptyAndDev } from './seed';

export const DATABASE_NAME = 'pocketlog.db';

/**
 * `SQLiteProvider` init hook.
 *
 * Order matters: migrate (which turns on foreign keys) before seeding, and seed
 * categories before any activity so the `ON DELETE RESTRICT` reference resolves.
 */
export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await migrateDb(db);
  await categoriesRepo.seedDefaults(db);
  await seedIfEmptyAndDev(db);
}

export { SQLiteProvider };
export type { SQLiteDatabase };