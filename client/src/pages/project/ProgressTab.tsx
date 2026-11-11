import { progressStatusSchema, type ProgressStatus, type StatusMapEntry } from '@bim/shared';
import { useState, type FormEvent } from 'react';
import { getElementHistory, recordProgress, setPlannedDate } from '../../api/progress';
import { formatDate, formatIsoDate, formatNumber } from '../../format';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import { STATUS_LABELS, todayIso } from '../../progressLabels';
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
      {STATUS_LABELS[status]}
    </span>
  );
}

function ElementHistory({ entry, dataVersion }: { entry: StatusMapEntry; dataVersion: number }) {
  const { state } = useAsync(
    (signal) => getElementHistory(entry.id, signal),
    `${entry.id}:${dataVersion}`,
  );
  return (
    <div className="history">
      <h2>Historial del elemento</h2>
      <p className="muted small">
        {/* Taken from the history itself (newest record first) so both always agree. */}
        Estado actual:{' '}
        <StatusBadge
          status={state.status === 'success' ? (state.data[0]?.status ?? 'PENDING') : entry.status}
        />
        {entry.plannedDate && <> · Programado para el {formatIsoDate(entry.plannedDate)}</>}
      </p>
      {state.status === 'loading' && <p className="muted small">Cargando historial…</p>}
      {state.status === 'error' && <p className="error-text small">{state.error}</p>}
      {state.status === 'success' && state.data.length === 0 && (
        <p className="muted small">Sin registros: el elemento está pendiente.</p>
      )}
      {state.status === 'success' && state.data.length > 0 && (
        <ol className="history-list">
          {state.data.map((record) => (
            <li key={record.id}>
              <span className="history-date">{formatIsoDate(record.date)}</span>
              <StatusBadge status={record.status} />
              {record.note && <span className="history-note">{record.note}</span>}
              <span className="muted small">registrado el {formatDate(record.createdAt)}</span>
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
  const [status, setStatus] = useState<ProgressStatus>('DONE');
  const [date, setDate] = useState(todayIso);
  const [note, setNote] = useState('');
  const [plannedDate, setPlannedDateValue] = useState(todayIso);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const selected = new Set(selectedGuids);
  const selectedEntries = statusMap.filter((e) => selected.has(e.globalId));
  const first = statusMap.find((e) => e.globalId === selectedGuids[0]);
  const count = selectedEntries.length;
  const breakdown = (['DONE', 'IN_PROGRESS', 'PENDING'] as const)
    .map((s) => [s, selectedEntries.filter((e) => e.status === s).length] as const)
    .filter(([, n]) => n > 0);

  async function run(action: () => Promise<string>) {
    setBusy(true);
    setMessage(null);
    try {
      setMessage(await action());
      onDataChanged();
    } catch (err) {
      setMessage(errorMessage(err));
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
      return `${formatNumber(affected)} elemento(s) marcados como "${STATUS_LABELS[status]}" el ${formatIsoDate(date)}.`;
    });
  }

  const plan = (value: string | null) =>
    run(async () => {
      const { affected } = await setPlannedDate(projectId, selectedGuids, value);
      return value
        ? `Fecha programada ${formatIsoDate(value)} asignada a ${formatNumber(affected)} elemento(s).`
        : `Fecha programada quitada de ${formatNumber(affected)} elemento(s).`;
    });

  return (
    <div className="progress-tab">
      <div className="selection-summary">
        <strong>
          {count === 0 ? 'Sin selección' : `${formatNumber(count)} elemento(s) seleccionado(s)`}
        </strong>
        {breakdown.map(([s, n]) => (
          <span key={s} className="muted small">
            <StatusBadge status={s} /> {formatNumber(n)}
          </span>
        ))}
        {count === 0 && (
          <span className="muted small">
            Selecciona elementos en el modelo o en las tablas (p. ej. una línea del presupuesto).
          </span>
        )}
      </div>

      <div className="progress-forms">
        <form className="item-form" onSubmit={handleRecord}>
          <h2>Registrar avance</h2>
          <fieldset className="status-options">
            <legend className="visually-hidden">Estado</legend>
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
              Fecha
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
                Nota <span className="muted">(opcional)</span>
              </span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={500}
                placeholder="Ej. Fundida segunda losa"
              />
            </label>
          </div>
          <button type="submit" className="primary" disabled={busy || count === 0}>
            Registrar en {formatNumber(count)} elemento(s)
          </button>
        </form>

        <div className="item-form">
          <h2>Programación</h2>
          <p className="muted small">
            La fecha programada alimenta la línea "programado" de la curva S del tablero.
          </p>
          <label className="stacked-label">
            Fecha programada
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
              Asignar fecha
            </button>
            <button type="button" onClick={() => void plan(null)} disabled={busy || count === 0}>
              Quitar fecha
            </button>
          </div>
        </div>
      </div>

      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      {first ? (
        <ElementHistory entry={first} dataVersion={dataVersion} />
      ) : (
        count === 0 && (
          <p className="muted small">Selecciona un elemento para ver su historial de avance.</p>
        )
      )}
    </div>
  );
}
