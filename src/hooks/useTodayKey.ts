import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { dayKey } from '@/utils/time';

/**
 * Today's day key, as live state.
 *
 * Every screen needs "today" to define its window, but a bare `dayKey(new Date())` in
 * a render body is a trap in two ways: it allocates a fresh value on every render, so
 * it cannot be a `useMemo` dependency without invalidating the memo every time, and
 * it silently goes stale if the app is left open across midnight — which for a daily
 * log is exactly the case that matters. A log opened at 23:50 and reviewed at 00:10
 * would still show yesterday.
 *
 * So the key is state, refreshed whenever the screen regains focus and whenever the
 * clock crosses into a new day while the app stays open. Screens that derive query
 * ranges from it re-read on the new day, which is the desired behaviour.
 *
 * ```tsx
 * const today = useTodayKey();
 * const rows = useTodayActivities(today);
 * ```
 */
export function useTodayKey(): string {
  const [key, setKey] = useState(() => dayKey(new Date()));

  // Focus covers the common case: navigating back into the app after midnight.
  useFocusEffect(
    useCallback(() => {
      const now = dayKey(new Date());
      setKey((current) => (current === now ? current : now));
    }, []),
  );

  // Covers the case where the app is already foregrounded across midnight. A single
  // timer to the next local midnight is cheaper than polling.
  useEffect(() => {
    const now = new Date();
    const nextMidnight = new Date(now);
    nextMidnight.setHours(24, 0, 0, 0);

    const timer = setTimeout(() => {
      setKey(dayKey(new Date()));
    }, Math.max(1000, nextMidnight.getTime() - now.getTime()));

    return () => clearTimeout(timer);
  }, [key]);

  return key;
}