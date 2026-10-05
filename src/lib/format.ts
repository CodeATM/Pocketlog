/** Number and text formatting shared across screens. */

const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
const decimalFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 });

export function formatCount(value: number): string {
  return integerFormatter.format(Math.round(value));
}

/** Trims a trailing `.0` so 3 hours reads as `3`, not `3.0`. */
export function formatHours(hours: number): string {
  if (!Number.isFinite(hours)) return '0';
  return Number.isInteger(hours) ? integerFormatter.format(hours) : decimalFormatter.format(hours);
}

/** `0`–`100`, for horizontal category bars. */
export function toPercent(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return count === 1 ? singular : plural;
}

/** Case-insensitive substring match used by search over titles and notes. */
export function matchesQuery(query: string, ...fields: (string | null | undefined)[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}