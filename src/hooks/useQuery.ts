import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { SQLiteDatabase } from '@/db/client';
import { useDbStore } from '@/stores/dbStore';

export type QueryResult<T> = {
  data: T | undefined;
  error: Error | null;
  /** True only for the very first load, when there is nothing to show yet. */
  isLoading: boolean;
  /** True while any load is in flight, including background refreshes. */
  isFetching: boolean;
  refresh: () => void;
};

type State<T> = {
  data: T | undefined;
  error: Error | null;
  /** The request key whose result is currently held. */
  settledKey: string | null;
};

/**
 * Reads from SQLite and re-reads whenever the database revision changes.
 *
 * Screens never hold query results in state — this hook is the only place data
 * enters React, which is what makes SQLite the single source of truth.
 *
 * `deps` are primitives (day keys, ids, a search term). They are serialised into
 * a single key rather than spread into the effect's dependency array, because a
 * variable-length dependency array makes React throw whenever the list changes
 * length between renders.
 *
 * Loading state is *derived* from that key rather than stored: a request is in
 * flight exactly when the key it was issued for is not the key on screen. That
 * avoids setting state synchronously inside the effect, which would cascade an
 * extra render on every single query.
 */
export function useQuery<T>(
  run: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly unknown[],
): QueryResult<T> {
  const db = useSQLiteContext();
  const revision = useDbStore((state) => state.revision);
  const [nonce, setNonce] = useState(0);
  const [state, setState] = useState<State<T>>({
    data: undefined,
    error: null,
    settledKey: null,
  });

  // `nonce` is part of the key so an explicit refresh is also treated as a pending
  // request, not just a dependency change.
  const key = `${JSON.stringify(deps)}#${nonce}`;

  // The query function is usually inline, so it changes identity every render.
  // Holding it in a ref keeps that out of the effect's dependencies. This effect
  // is declared first so the ref is already current when the query effect runs.
  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);

  useEffect(() => {
    let cancelled = false;

    runRef
      .current(db)
      .then((data) => {
        if (cancelled) return;
        setState({ data, error: null, settledKey: key });
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // The previous `data` is deliberately kept: a transient failure should
        // degrade to stale-but-useful rather than blanking the screen.
        setState((previous) => ({
          ...previous,
          error: cause instanceof Error ? cause : new Error(String(cause)),
          settledKey: key,
        }));
      });

    return () => {
      cancelled = true;
    };
  }, [db, revision, key]);

  const refresh = useCallback(() => {
    setNonce((value) => value + 1);
  }, []);

  const isSettled = state.settledKey === key;

  return {
    data: state.data,
    // An error from a previous key is not this screen's error any more.
    error: isSettled ? state.error : null,
    isLoading: !isSettled && state.data === undefined,
    isFetching: !isSettled,
    refresh,
  };
}