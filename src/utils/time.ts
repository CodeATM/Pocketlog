/**
 * The single time surface.
 *
 * Every date, time and duration string in the app is produced here. Nothing else
 * calls `Intl.DateTimeFormat`, and no component does its own arithmetic on
 * minutes — so a duration reads the same in a timeline rail, a details table, a
 * chart tooltip and a screen-reader label.
 *
 * Two conventions run through the file:
 *
 * 1. **Local time, always.** A "day" is the device's local calendar day, never a
 *    UTC one. `dayKey` is `YYYY-MM-DD` local, which is also what the SQLite
 *    indexes are built on.
 * 2. **Tabular figures for anything countable.** Durations and clock times are
 *    rendered with the Poppins tabular variant so a column lines up; spoken output
 *    comes from the `spoken*` functions instead of the visual ones.
 */

const MINUTES_PER_HOUR = 60;
const MS_PER_MINUTE = 60_000;

/* --------------------------------------------------------------- day keys -- */

export const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const pad = (value: number) => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for the local calendar day containing `date`. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(): string {
  return dayKey(new Date());
}

/** Strict `YYYY-MM-DD` parse. Returns `null` for malformed or out-of-range input. */
export function parseDayKey(key: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;

  // Rejects `2025-02-31`, which the regex alone would accept.
  const probe = new Date(year, month - 1, day);
  if (probe.getMonth() !== month - 1 || probe.getDate() !== day) return null;

  return { year, month, day };
}

export function isDayKey(value: unknown): value is string {
  return typeof value === 'string' && DAY_KEY_PATTERN.test(value) && parseDayKey(value) !== null;
}

/** Local midnight at the start of the day named by `key`. */
export function fromDayKey(key: string): Date {
  const parts = parseDayKey(key);
  if (!parts) return new Date(NaN);
  return new Date(parts.year, parts.month - 1, parts.day);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Adds days by calendar, not by milliseconds, so it stays correct across DST
 * transitions where a day can be 23 or 25 hours long.
 */
export function addDays(date: Date, amount: number): Date {
  const next = startOfDay(date);
  next.setDate(next.getDate() + amount);
  return next;
}

/** Clamps the day-of-month so `31 Jan + 1 month` lands on the last of February. */
export function addMonths(date: Date, amount: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/** Midnight on the first day of the week containing `date`. */
export function startOfWeek(date: Date, weekStartsOn: number): Date {
  const start = startOfDay(date);
  return addDays(start, -((start.getDay() - weekStartsOn + 7) % 7));
}

/** Exactly seven day keys, starting at the week containing `date`. */
export function weekDayKeys(date: Date, weekStartsOn: number): string[] {
  const start = startOfWeek(date, weekStartsOn);
  return Array.from({ length: 7 }, (_, index) => dayKey(addDays(start, index)));
}

/**
 * Six rows of seven day keys covering the month.
 *
 * Always six rows so the calendar keeps a constant height while paging; days
 * outside the month are included and rendered dimmed, as platform calendars do.
 */
export function monthGridKeys(year: number, month: number, weekStartsOn: number): string[][] {
  const cursor = startOfWeek(new Date(year, month, 1), weekStartsOn);
  return Array.from({ length: 6 }, (_, week) =>
    Array.from({ length: 7 }, (_, day) => dayKey(addDays(cursor, week * 7 + day))),
  );
}

/** Inclusive, ascending list of day keys between two keys. */
export function dayKeyRange(from: string, to: string): string[] {
  const start = fromDayKey(from);
  const end = fromDayKey(to);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];

  const keys: string[] = [];
  let cursor = start;
  // Guard against an inverted range producing an unbounded loop.
  for (let i = 0; i < 3660 && cursor <= end; i += 1) {
    keys.push(dayKey(cursor));
    cursor = addDays(cursor, 1);
  }
  return keys;
}

export function daysBetween(fromKey: string, toKey: string): number {
  const from = fromDayKey(fromKey).getTime();
  const to = fromDayKey(toKey).getTime();
  return Math.round((to - from) / 86_400_000);
}

/* -------------------------------------------------------------- durations -- */

/** Clamps and rounds a raw minute count into the range the app allows. */
export function normaliseMinutes(minutes: number, min = 1, max = 24 * 60): number {
  if (!Number.isFinite(minutes)) return min;
  return Math.min(max, Math.max(min, Math.round(minutes)));
}

/**
 * Compact visual duration: `45m`, `2h`, `2h 30m`, `0m`.
 *
 * This is the default everywhere a duration appears as a number — it is the
 * string that lines up in a column.
 */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < MINUTES_PER_HOUR) return `${total}m`;

  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Like `formatDuration` but with a space before the unit: `2h 30m`. */
export function formatDurationSpaced(minutes: number): string {
  return formatDuration(minutes).replace(/^(\d+)h$/, '$1 h').replace(/^(\d+)m$/, '$1 m');
}

/**
 * Spoken duration for accessibility labels: "2 hours 30 minutes".
 *
 * Never abbreviates, never uses symbols, and collapses a zero remainder so a
 * reader does not hear "1 hour 0 minutes".
 */
export function spokenDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total === 0) return 'no time';

  const hours = Math.floor(total / MINUTES_PER_HOUR);
  const rest = total % MINUTES_PER_HOUR;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hour' : 'hours'}`);
  if (rest > 0) parts.push(`${rest} ${rest === 1 ? 'minute' : 'minutes'}`);
  return parts.join(' ');
}

export function splitDuration(minutes: number): { hours: number; minutes: number } {
  const total = Math.max(0, Math.round(minutes));
  return { hours: Math.floor(total / MINUTES_PER_HOUR), minutes: total % MINUTES_PER_HOUR };
}

export function joinDuration(hours: number, minutes: number): number {
  return Math.max(0, Math.round(hours)) * MINUTES_PER_HOUR + Math.max(0, Math.round(minutes));
}

/** Snaps a minute count to the nearest 5, for the duration stepper. */
export function snapToStep(minutes: number, step = 5): number {
  return Math.round(minutes / step) * step;
}

/**
 * Guesses a duration from the gap since the previous activity, so logging
 * straight after something else pre-fills a plausible number. Rounded to five
 * minutes and clamped to something believable.
 */
export function suggestDurationFromGap(gapMinutes: number | null): number | null {
  if (gapMinutes === null || !Number.isFinite(gapMinutes) || gapMinutes < 1) return null;
  return Math.min(Math.max(snapToStep(gapMinutes, 5), 5), 8 * MINUTES_PER_HOUR);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * MS_PER_MINUTE);
}

export function minutesBetween(from: Date, to: Date): number {
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / MS_PER_MINUTE));
}

/** Fraction of the 24h day occupied, used to size the day-segment bars. */
export function shareOfDay(minutes: number): number {
  return Math.min(1, Math.max(0, minutes / (24 * MINUTES_PER_HOUR)));
}

/* -------------------------------------------------------------- date text -- */

const locale = undefined;

const timeOfDay = new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit' });
const weekdayLong = new Intl.DateTimeFormat(locale, { weekday: 'long' });
const weekdayShort = new Intl.DateTimeFormat(locale, { weekday: 'short' });
const weekdayNarrow = new Intl.DateTimeFormat(locale, { weekday: 'narrow' });
const dayMonth = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' });
const monthShort = new Intl.DateTimeFormat(locale, { month: 'short' });
const fullDate = new Intl.DateTimeFormat(locale, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

/** Clock time, `9:05 AM` or `09:05` depending on locale. */
export function formatTime(date: Date): string {
  return timeOfDay.format(date);
}

/** Spoken clock time for accessibility labels: "9:05 in the morning". */
export function spokenTime(date: Date): string {
  const hour = date.getHours();
  const period = hour < 12 ? 'in the morning' : hour < 18 ? 'in the afternoon' : 'in the evening';
  const twelveHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelveHour}:${pad(date.getMinutes())} ${period}`;
}

export function formatWeekday(date: Date): string {
  return weekdayLong.format(date);
}

export function formatWeekdayShort(date: Date): string {
  return weekdayShort.format(date);
}

export function formatDayMonth(date: Date): string {
  return dayMonth.format(date);
}

export function formatMonthYear(date: Date): string {
  return monthYear.format(date);
}

export function formatMonthShort(date: Date): string {
  return monthShort.format(date);
}

/** `Thursday, 3 October` — used in the home header and details table. */
export function formatFullDate(date: Date): string {
  return fullDate.format(date);
}

/** `Today`, `Yesterday`, or `Thu, 3 Oct` for section headers. */
export function formatDayHeading(key: string): string {
  const date = fromDayKey(key);
  if (Number.isNaN(date.getTime())) return key;
  if (isToday(date)) return 'Today';
  if (isSameDay(date, addDays(new Date(), -1))) return 'Yesterday';
  return `${weekdayShort.format(date)}, ${pad(date.getDate())} ${monthShort.format(date)}`;
}

/** `Oct 3` — dense enough for a calendar cell or a search group header. */
export function formatShortDay(key: string): string {
  const date = fromDayKey(key);
  if (Number.isNaN(date.getTime())) return key;
  return `${monthShort.format(date)} ${pad(date.getDate())}`;
}

/** Month heading for search result groups: `October 2025`. */
export function formatMonthHeading(key: string): string {
  const date = fromDayKey(key);
  if (Number.isNaN(date.getTime())) return key;
  return monthYear.format(date);
}

export function weekdayInitials(weekStartsOn: number): string[] {
  // 2024-01-07 was a Sunday, so index 0 is Sunday.
  const sunday = new Date(2024, 0, 7);
  return Array.from({ length: 7 }, (_, index) =>
    weekdayNarrow.format(addDays(sunday, (index + weekStartsOn) % 7)),
  );
}

/* ------------------------------------------------------------------ speech -- */

/**
 * Builds the accessibility label for one timeline row, in the order a person
 * would say it: what it was, how long, when it started.
 */
export function spokenActivity(input: {
  title: string;
  categoryName: string;
  startedAt: Date;
  durationMinutes: number;
}): string {
  return `${input.title}, ${input.categoryName}, ${spokenDuration(input.durationMinutes)}, started ${spokenTime(input.startedAt)}`;
}

export function spokenCount(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Signed percentage for the period-over-period delta: `+12%`, `-8%`. */
export function formatDelta(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? 'no change' : 'new';
  const percent = Math.round(((current - previous) / previous) * 100);
  if (percent === 0) return 'no change';
  return `${percent > 0 ? '+' : ''}${percent}%`;
}