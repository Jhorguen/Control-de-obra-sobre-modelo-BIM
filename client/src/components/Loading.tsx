import { useDelayedFlag } from '../hooks/useDelayedFlag';

/**
 * Loading message. The free hosting plan stops the API after ~15 minutes without traffic
 * and the first request then takes up to a minute: after a few seconds, say so instead
 * of leaving the visitor in front of a spinner.
 */
export function Loading({ text }: { text: string }) {
  const slow = useDelayedFlag(5000);
  return (
    <div className="loading" role="status">
      <span className="spinner" aria-hidden="true" />
      <div>
        <p>{text}</p>
        {slow && (
          <p className="muted small">
            El servidor gratuito se apaga cuando no hay visitas y puede tardar hasta un minuto en
            despertar. Gracias por la paciencia.
          </p>
        )}
      </div>
    </div>
  );
}
