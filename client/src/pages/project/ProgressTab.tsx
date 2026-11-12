import { progressStatusSchema, type ProgressStatus, type StatusMapEntry } from '@bim/shared';
import { useState, type FormEvent } from 'react';
import { getElementHistory, recordProgress, setPlannedDate } from '../../api/progress';
import { formatDate, formatIsoDate, formatNumber } from '../../format';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import { useI18n } from '../../i18n/useI18n';
import { statusLabel, todayIso } from '../../progressLabels';
import { toast } from '../../toast';
import { STATUS_COLORS } from '../../viewer/BimViewer';

interface Props {
  projectId: number;
  dataVersion: number;
  selectedGuids: readonly string[];
  statusMap: readonly StatusMapEntry[];
  onDataChanged: () => void;
}

function StatusBadge({ status }: { status: ProgressStatus }) {
  return (
    <span className="status-badge">
      <span className="swatch" style={{ background: STATUS_COLORS[status] }} aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}

function ElementHistory({ entry, dataVersion }: { entry: StatusMapEntry; dataVersion: number }) {
  const { t } = useI18n();
  const { state } = useAsync(
    (signal) => getElementHistory(entry.id, signal),
    `${entry.id}:${dataVersion}`,
  );
  return (
    <div className="history">
      <h2>{t('progress.history')}</h2>
      <p className="muted small">
        {/* Taken from the history itself (newest record first) so both always agree. */}
        {t('progress.current')}{' '}
        <StatusBadge
          status={state.status === 'success' ? (state.data[0]?.status ?? 'PENDING') : entry.status}
        />
        {entry.plannedDate && (
          <> · {t('progress.plannedFor', { date: formatIsoDate(entry.plannedDate) })}</>
        )}
      </p>
      {state.status === 'loading' && <p className="muted small">{t('progress.historyLoading')}</p>}
      {state.status === 'error' && <p className="error-text small">{state.error}</p>}
      {state.status === 'success' && state.data.length === 0 && (
        <p className="muted small">{t('progress.noRecords')}</p>
      )}
      {state.status === 'success' && state.data.length > 0 && (
        <ol className="history-list">
          {state.data.map((record) => (
            <li key={record.id}>
              <span className="history-date">{formatIsoDate(record.date)}</span>
              <StatusBadge status={record.status} />
              {record.note && <span className="history-note">{record.note}</span>}
              <span className="muted small">
                {t('progress.recordedOn', { date: formatDate(record.createdAt) })}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function ProgressTab({
  projectId,
  dataVersion,
  selectedGuids,
  statusMap,
  onDataChanged,
}: Props) {
  const { t, tp } = useI18n();
  const [status, setStatus] = useState<ProgressStatus>('DONE');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [plannedDate, setPlannedDateValue] = useState(todayIso);
  const [busy, setBusy] = useState(false);

  const selected = new Set(selectedGuids);
  const selectedEntries = statusMap.filter((e) => selected.has(e.globalId));
  const first = statusMap.find((e) => e.globalId === selectedGuids[0]);
  const count = selectedEntries.length;
  const breakdown = (['DONE', 'IN_PROGRESS', 'PENDING'] as const)
    .map((s) => [s, selectedEntries.filter((e) => e.status === s).length] as const)
    .filter(([, n]) => n > 0);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    try {
      toast(await action());
      onDataChanged();
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setBusy(false);
    }
  }

  function handleRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(async () => {
      const { affected } = await recordProgress(projectId, {
        globalIds: selectedGuids.slice(),
        status,
        date,
        note: note || undefined,
      });
      setNote('');
      return tp('progress.recorded', affected, {
        count: formatNumber(affected),
        status: statusLabel(status),
        date: formatIsoDate(date),
      });
    });
  }

  const plan = (value: string | null) =>
    run(async () => {
      const { affected } = await setPlannedDate(projectId, selectedGuids, value);
      const count = formatNumber(affected);
      return value
        ? tp('progress.planned', affected, { count, date: formatIsoDate(value) })
        : tp('progress.unplanned', affected, { count });
    });

  return (
    <div className="progress-tab">
      <div className="selection-summary">
        <strong>
          {count === 0
            ? t('common.noSelection')
            : tp('common.selected', count, { count: formatNumber(count) })}
        </strong>
        {breakdown.map(([s, n]) => (
          <span key={s} className="muted small">
            <StatusBadge status={s} /> {formatNumber(n)}
          </span>
        ))}
        {count === 0 && <span className="muted small">{t('progress.selectHint')}</span>}
      </div>

      <div className="progress-forms">
        <form className="item-form" onSubmit={handleRecord}>
          <h2>{t('progress.record')}</h2>
          <fieldset className="status-options">
            <legend className="visually-hidden">{t('progress.status')}</legend>
            {progressStatusSchema.options.map((option) => (
              <label key={option} className={status === option ? 'checked' : ''}>
                <input
                  type="radio"
                  name="status"
                  value={option}
                  checked={status === option}
                  onChange={() => setStatus(option)}
                />
                <StatusBadge status={option} />
              </label>
            ))}
          </fieldset>
          <div className="form-grid two">
            <label>
              {t('common.date')}
              <input
                type="date"
                value={date}
                max={todayIso()}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </label>
            <label>
              <span>
                {t('progress.note')} <span className="muted">{t('common.optional')}</span>
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder={t('progress.notePlaceholder')}
              />
            </label>
          </div>
          <button type="submit" className="primary" disabled={busy || count === 0}>
            {tp('progress.submit', count, { count: formatNumber(count) })}
          </button>
        </form>

        <div className="item-form">
          <h2>{t('progress.schedule')}</h2>
          <p className="muted small">{t('progress.scheduleNote')}</p>
          <label className="stacked-label">
            {t('progress.plannedDate')}
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDateValue(e.target.value)}
            />
          </label>
          <div className="row">
            <button
              type="button"
              className="primary"
              onClick={() => void plan(plannedDate)}
              disabled={busy || count === 0 || !plannedDate}
            >
              {t('progress.setDate')}
            </button>
            <button type="button" onClick={() => void plan(null)} disabled={busy || count === 0}>
              {t('progress.clearDate')}
            </button>
          </div>
        </div>
      </div>

      {first ? (
        <ElementHistory entry={first} dataVersion={dataVersion} />
      ) : (
        count === 0 && <p className="muted small">{t('progress.historyHint')}</p>
      )}
    </div>
  );
}
