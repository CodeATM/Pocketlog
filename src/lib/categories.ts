import { categoryGlyphs, categorySolids } from '@/theme/tokens';
import type { Category } from '@/types/category';

/**
 * The seven default categories.
 *
 * Colours and glyphs are imported from the token layer rather than restated, so
 * the database rows and the design system can never disagree — the two themes are
 * stored per row purely because a category's colour must stay correct when the
 * scheme flips.
 */
export const DEFAULT_CATEGORIES: readonly Category[] = (
  [
    ['work', 'Work'],
    ['study', 'Study'],
    ['health', 'Health'],
    ['ideas', 'Ideas'],
    ['social', 'Social'],
    ['personal', 'Personal'],
    ['other', 'Other'],
  ] as const
).map(([id, name], index) => ({
  id,
  name,
  icon: categoryGlyphs[id],
  colorLight: categorySolids.light[id],
  colorDark: categorySolids.dark[id],
  sortOrder: index,
  isDefault: true,
  createdAt: '',
}));

export const FALLBACK_CATEGORY_ID = 'other';

/**
 * Category solid for the active scheme. Accepts a database row so a category that
 * was customised out of band still renders in its own colour rather than the
 * built-in one.
 */
export function solidFor(
  scheme: 'light' | 'dark',
  category: Pick<Category, 'id' | 'colorLight' | 'colorDark'> | null | undefined,
): string {
  if (!category) {
    return categorySolids[scheme][FALLBACK_CATEGORY_ID];
  }
  return scheme === 'dark' ? category.colorDark : category.colorLight;
}

export function glyphFor(category: Pick<Category, 'id' | 'icon'> | null | undefined): string {
  return category?.icon ?? categoryGlyphs.other;
}