import type { ProgressStatus } from '@bim/shared';
import { formatNumber, formatPercent } from '../format';
import { STATUS_LABELS } from '../progressLabels';

export interface StatusCounts {
  done: number;
  inProgress: number;
  pending: number;
}

const SEGMENTS: { status: ProgressStatus; key: keyof StatusCounts }[] = [
  { status: 'DONE', key: 'done' },
  { status: 'IN_PROGRESS', key: 'inProgress' },
  { status: 'PENDING', key: 'pending' },
];

/**
 * The site's progress at a glance: executed, in progress and pending elements as one
 * segmented band, the same colors the model uses. Shown under the project title and on
 * the dashboard. The band draws in once when it appears (see .ribbon in styles.css).
 */
export function ProgressRibbon({
  counts,
  compact = false,
}: {
  counts: StatusCounts;
  compact?: boolean;
}) {
  const total = counts.done + counts.inProgress + counts.pending;
  if (total === 0) return null;

  return (
    <div className={`ribbon ${compact ? 'ribbon--compact' : ''}`}>
      <div
        className="ribbon-bar"
        role="img"
        aria-label={`Avance físico ${formatPercent(counts.done / total)}: ${SEGMENTS.map(
          ({ status, key }) => `${STATUS_LABELS[status]} ${counts[key]}`,
        ).join(', ')}`}
      >
        {SEGMENTS.map(({ status, key }) =>
          counts[key] > 0 ? (
            <span
              key={status}
              className={`ribbon-segment status-${status}`}
              style={{ flexGrow: counts[key] }}
            />
          ) : null,
        )}
      </div>
      <ul className="ribbon-legend">
        <li className="ribbon-total">
          <strong>{formatPercent(counts.done / total)}</strong> ejecutado
        </li>
        {SEGMENTS.map(({ status, key }) => (
          <li key={status}>
            <span className={`swatch status-${status}`} aria-hidden="true" />
            {STATUS_LABELS[status]} <span className="num">{formatNumber(counts[key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
