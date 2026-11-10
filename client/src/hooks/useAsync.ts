import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/http';

export type AsyncState<T> =
  { status: 'loading' } | { status: 'success'; data: T } | { status: 'error'; error: string };

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  // Unexpected (non-API) errors are logged so they can be diagnosed from the console.
  console.error(error);
  return 'Ocurrió un error inesperado.';
}

/**
 * Runs an async loader and tracks its state. It runs again when `key` changes or after
 * `reload()` (e.g. after a mutation); meanwhile the previous data stays on screen, so
 * tables do not flicker and their surrounding controls keep their state. Screens that
 * show a different entity are remounted with a React `key` instead.
 * A response that arrives after a newer request started is ignored.
 */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    loader(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setState({ status: 'success', data });
      },
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ status: 'error', error: errorMessage(error) });
      },
    );
    return () => controller.abort();
    // The loader is recreated on every render; `key` and `version` decide when to refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, version]);

  const reload = useCallback(() => {
    // After an error, show the loading state again so "Reintentar" gives feedback.
    setState((current) => (current.status === 'error' ? { status: 'loading' } : current));
    setVersion((v) => v + 1);
  }, []);

  /** Replaces the data locally without refetching (after a mutation that returns it). */
  const setData = useCallback((data: T) => setState({ status: 'success', data }), []);

  return { state, reload, setData };
}
