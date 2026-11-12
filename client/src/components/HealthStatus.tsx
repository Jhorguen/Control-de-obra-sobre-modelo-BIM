import type { HealthResponse } from '@bim/shared';
import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '../api/health';
import { errorMessage } from '../hooks/useAsync';
import { useDelayedFlag } from '../hooks/useDelayedFlag';
import { useI18n } from '../i18n/useI18n';

type HealthState =
  | { kind: 'loading' }
  | { kind: 'success'; health: HealthResponse }
  | { kind: 'error'; error: unknown };

function useHealth() {
  const [state, setState] = useState<HealthState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchHealth(controller.signal).then(
      (health) => setState({ kind: 'success', health }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ kind: 'error', error });
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
  const slow = useDelayedFlag(5000);
  const { t } = useI18n();

  let tone: 'ok' | 'warn' | 'error' | 'pending' = 'pending';
  // A free-tier API that slept answers its first request after up to a minute.
  let label = slow ? t('health.waking') : t('health.connecting');
  let detail = '';
  if (state.kind === 'success') {
    const dbUp = state.health.database === 'up';
    tone = dbUp ? 'ok' : 'warn';
    label = dbUp ? t('health.ok') : t('health.dbDown');
  } else if (state.kind === 'error') {
    tone = 'error';
    label = t('health.down');
    detail = errorMessage(state.error);
  }

  return (
    <button
      type="button"
      className={`status-pill status-pill--${tone}`}
      onClick={retry}
      title={detail || t('health.retryHint')}
      aria-live="polite"
    >
      <span className="status-dot" aria-hidden="true" />
      <span className="status-label">{label}</span>
    </button>
  );
}
