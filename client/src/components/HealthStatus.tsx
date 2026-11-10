import type { HealthResponse } from '@bim/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../api/health';
import { ApiError } from '../api/http';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'success'; health: HealthResponse }
  | { kind: 'error'; message: string };

const timeFormat = new Intl.DateTimeFormat('es-CO', { timeStyle: 'medium' });

function useHealth() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      (health) => setState({ kind: 'success', health }),
      (error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof ApiError ? error.message : 'Ocurrió un error inesperado.';
        setState({ kind: 'error', message });
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

function StatusRow({ label, ok, text }: { label: string; ok: boolean; text: string }) {
  return (
    <div className="status-row">
      <dt>{label}</dt>
      <dd>
        <span className={`badge ${ok ? 'badge--ok' : 'badge--error'}`}>{text}</span>
      </dd>
    </div>
  );
}

export function HealthStatus() {
  const { state, retry } = useHealth();
  const loading = state.kind === 'loading';

  return (
    <section className="card" aria-labelledby="health-title" aria-busy={loading}>
      <div className="card__header">
        <h2 id="health-title">Estado del sistema</h2>
        <button type="button" onClick={retry} disabled={loading}>
          Volver a consultar
        </button>
      </div>

      {state.kind === 'loading' && <p className="muted">Consultando el servidor…</p>}

      {state.kind === 'error' && (
        <>
          <dl>
            <StatusRow label="API" ok={false} text="Sin conexión" />
          </dl>
          <p className="muted">{state.message}</p>
        </>
      )}

      {state.kind === 'success' && (
        <dl>
          <StatusRow label="API" ok text="Conectada" />
          <StatusRow
            label="Base de datos"
            ok={state.health.database === 'up'}
            text={state.health.database === 'up' ? 'Conectada' : 'Sin conexión'}
          />
          <div className="status-row">
            <dt>Última consulta</dt>
            <dd>{timeFormat.format(new Date(state.health.timestamp))}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
