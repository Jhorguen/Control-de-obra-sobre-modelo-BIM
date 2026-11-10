import type { HealthResponse } from '@bim/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../api/health';
import { errorMessage } from '../hooks/useAsync';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'success'; health: HealthResponse }
  | { kind: 'error'; message: string };

function useHealth() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      (health) => setState({ kind: 'success', health }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: 'error', message: errorMessage(error) });
      },
    );
    // Abort on unmount or retry so a stale response never overwrites a newer one.
    return () => controller.abort();
  }, [attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { state, retry };
}

/** Compact server status shown in the header (API and database). */
export function HealthStatus() {
  const { state, retry } = useHealth();

  let tone: 'ok' | 'warn' | 'error' | 'pending' = 'pending';
  let label = 'Conectando con el servidor…';
  let detail = '';
  if (state.kind === 'success') {
    const dbUp = state.health.database === 'up';
    tone = dbUp ? 'ok' : 'warn';
    label = dbUp ? 'Servidor conectado' : 'Base de datos sin conexión';
  } else if (state.kind === 'error') {
    tone = 'error';
    label = 'Servidor sin conexión';
    detail = state.message;
  }

  return (
    <button
      type="button"
      className={`status-pill status-pill--${tone}`}
      onClick={retry}
      title={detail || 'Clic para volver a consultar'}
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      {label}
    </button>
  );
}
