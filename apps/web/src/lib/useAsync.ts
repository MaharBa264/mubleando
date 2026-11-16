'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AsyncState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; data: T };

/** Carga datos y expone loading / error / ready, con `reload` para reintentar. */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]): AsyncState<T> & { reload: () => void } {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [n, setN] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setState({ status: 'loading' });
    fnRef.current().then(
      (data) => alive && setState({ status: 'ready', data }),
      (e: unknown) => alive && setState({ status: 'error', error: e instanceof Error ? e : new Error(String(e)) }),
    );
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n]);

  const reload = useCallback(() => setN((x) => x + 1), []);
  return { ...state, reload };
}
