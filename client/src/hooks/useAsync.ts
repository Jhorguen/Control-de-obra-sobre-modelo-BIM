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
 * Runs an async loader and tracks its state. `reload()` runs it again (e.g. after a
 * mutation). A response that arrives after a newer request started is ignored.
 */
export function useAsync<T>(loader: (signal: AbortSignal) => Promise<T>, key: string) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [prevKey, setPrevKey] = useState(key);

  // Show the loading state immediately when the key changes (adjusting state during
  // render is React's recommended alternative to setState inside an effect).
  if (key !== prevKey) {
    setPrevKey(key);
    setState({ status: 'loading' });
  }

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

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  /** Replaces the data locally without refetching (after a mutation that returns it). */
  const setData = useCallback((data: T) => setState({ status: 'success', data }), []);

  return { state, reload, setData };
}
