import type { SQLiteDatabase } from 'expo-sqlite';

import { DEFAULT_CATEGORIES } from '@/lib/categories';
import type { Category } from '@/types/category';

type CategoryRow = {
  id: string;
  name: string;
  icon: string;
  color_light: string;
  color_dark: string;
  sort_order: number;
  is_default: number;
  created_at: string;
};

function hydrate(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    colorLight: row.color_light,
    colorDark: row.color_dark,
    sortOrder: row.sort_order,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
  };
}

export async function listAll(db: SQLiteDatabase): Promise<Category[]> {
  const rows = await db.getAllAsync<CategoryRow>(
    'SELECT * FROM categories ORDER BY sort_order ASC, name ASC',
  );
  return rows.map(hydrate);
}

export async function getById(db: SQLiteDatabase, id: string): Promise<Category | null> {
  const row = await db.getFirstAsync<CategoryRow>('SELECT * FROM categories WHERE id = ?', id);
  return row ? hydrate(row) : null;
}

export async function count(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) AS count FROM categories');
  return row?.count ?? 0;
}

/**
 * Idempotently inserts any default category that is missing.
 *
 * Uses `INSERT OR IGNORE` on the primary key so re-running on an existing
 * database is a no-op, and existing rows (including user edits) are never
 * overwritten by a later app version changing a default's colour.
 */
export async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const createdAt = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (txn) => {
    for (const category of DEFAULT_CATEGORIES) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO categories
           (id, name, icon, color_light, color_dark, sort_order, is_default, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        category.id,
        category.name,
        category.icon,
        category.colorLight,
        category.colorDark,
        category.sortOrder,
        category.isDefault ? 1 : 0,
        createdAt,
      );
    }
  });
}