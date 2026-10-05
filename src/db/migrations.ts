import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Sequential, append-only migrations.
 *
 * `PRAGMA user_version` is the single source of truth for the schema version.
 * Never edit a shipped migration — add a new one. `execAsync` cannot bind
 * parameters, so every statement below is a literal with no user input in it.
 */
type Migration = {
  version: number;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    statements: [
      `CREATE TABLE IF NOT EXISTS categories (
         id TEXT PRIMARY KEY NOT NULL,
         name TEXT NOT NULL,
         icon TEXT NOT NULL,
         color_light TEXT NOT NULL,
         color_dark TEXT NOT NULL,
         sort_order INTEGER NOT NULL DEFAULT 0,
         is_default INTEGER NOT NULL DEFAULT 0,
         created_at TEXT NOT NULL
       );`,

      // `day` is a denormalised local YYYY-MM-DD so day grouping is one indexed
      // equality lookup and stays stable across later timezone changes.
      // `started_at` remains the authoritative instant, stored as ISO-8601 UTC.
      `CREATE TABLE IF NOT EXISTS activities (
         id TEXT PRIMARY KEY NOT NULL,
         title TEXT NOT NULL,
         category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
         notes TEXT,
         started_at TEXT NOT NULL,
         day TEXT NOT NULL,
         duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
         created_at TEXT NOT NULL,
         updated_at TEXT NOT NULL
       );`,

      `CREATE INDEX IF NOT EXISTS idx_activities_day ON activities (day);`,
      `CREATE INDEX IF NOT EXISTS idx_activities_started_at ON activities (started_at);`,
      `CREATE INDEX IF NOT EXISTS idx_activities_category_day ON activities (category_id, day);`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

async function readSchemaVersion(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

/**
 * Brings a database up to `LATEST_SCHEMA_VERSION`.
 *
 * WAL and foreign-key enforcement are set first and unconditionally: they are
 * connection settings rather than schema, so they must apply to an already
 * migrated database too. `foreign_keys` is per-connection and off by default in
 * SQLite, which is why the `ON DELETE RESTRICT` above only works because of this.
 */
export async function migrateDb(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  let current = await readSchemaVersion(db);
  if (current >= LATEST_SCHEMA_VERSION) return;

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;
    await db.execAsync(migration.statements.join('\n'));
    // `user_version` does not accept a bound parameter, and the value is a
    // compile-time integer from this file, so interpolation is safe here.
    await db.execAsync(`PRAGMA user_version = ${migration.version}`);
    current = migration.version;
  }
}