import type { ProgressSummary } from '@bim/shared';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts';
import { getProgressSummary } from '../../api/progress';
import {
  formatCOP,
  formatCOPCompact,
  formatIsoDate,
  formatNumber,
  formatPercent,
} from '../../format';
import { useAsync } from '../../hooks/useAsync';
import { STATUS_LABELS } from '../../progressLabels';
import { STATUS_COLORS } from '../../viewer/BimViewer';

// Chart styling follows the data-viz rules used across the app: two categorical slots
// validated for color-vision deficiency (blue, orange), thin marks, recessive grid and
// axes, a legend for every multi-series chart, hover tooltips and a data table.
const SERIES = { first: '#2a78d6', second: '#eb6834' };
const INK = { text: '#1d2433', muted: '#898781', grid: '#e1e0d9', axis: '#c3c2b7' };
const axisProps = {
  tick: { fill: INK.muted, fontSize: 12 },
  axisLine: { stroke: INK.axis },
  tickLine: false,
} as const;

/** Legend text stays in ink; the colored icon next to it carries the series identity. */
const legendProps = {
  wrapperStyle: { fontSize: 13 },
  itemSorter: null,
  formatter: (value: string) => <span style={{ color: INK.text }}>{value}</span>,
} as const;

/** "1/09/2026" -> "1/09" on crowded axes; the tooltip shows the full date. */
const shortDate = (iso: string) => formatIsoDate(iso).replace(/\/\d{4}$/, '');

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
  formatLabel = String,
}: TooltipContentProps & {
  formatValue: (value: number) => string;
  formatLabel?: (label: string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{formatLabel(String(label))}</strong>
      {payload.map((entry) => (
        <div key={String(entry.dataKey)}>
          <span className="swatch" style={{ background: entry.color }} aria-hidden="true" />
          {entry.name}: <b>{formatValue(Number(entry.value))}</b>
        </div>
      ))}
    </div>
  );
}

interface Props {
  projectId: number;
  dataVersion: number;
}

function Kpi({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-detail">{detail}</span>
    </div>
  );
}

function StatusBar({ counts }: { counts: ProgressSummary['counts'] }) {
  const total = counts.withItem || 1;
  const parts = [
    ['DONE', counts.done],
    ['IN_PROGRESS', counts.inProgress],
    ['PENDING', counts.pending],
  ] as const;
  return (
    <div className="status-bar-wrap">
      <div className="status-bar" role="img" aria-label="Elementos por estado">
        {parts.map(([status, n]) =>
          n > 0 ? (
            <span
              key={status}
              style={{ width: `${(n / total) * 100}%`, background: STATUS_COLORS[status] }}
              title={`${STATUS_LABELS[status]}: ${n}`}
            />
          ) : null,
        )}
      </div>
      <ul className="inline-list">
        {parts.map(([status, n]) => (
          <li key={status}>
            <span
              className="swatch"
              style={{ background: STATUS_COLORS[status] }}
              aria-hidden="true"
            />
            {STATUS_LABELS[status]}: {formatNumber(n)}
          </li>
        ))}
      </ul>
    </div>
  );
}

function LevelChart({ summary }: { summary: ProgressSummary }) {
  const data = summary.byLevel.map((level) => ({
    level: level.level ?? 'Sin nivel',
    physical: level.physicalProgress,
    financial: level.financialProgress,
  }));
  return (
    <figure className="chart">
      <figcaption>Avance por nivel</figcaption>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis dataKey="level" {...axisProps} />
          <YAxis
            {...axisProps}
            axisLine={false}
            domain={[0, 1]}
            ticks={[0, 0.25, 0.5, 0.75, 1]}
            tickFormatter={(v: number) => formatPercent(v)}
            width={56}
          />
          <Tooltip
            cursor={{ fill: 'rgba(11,11,11,0.04)' }}
            content={(props) => <ChartTooltip {...props} formatValue={formatPercent} />}
          />
          <Legend iconType="square" {...legendProps} />
          <Bar
            dataKey="physical"
            name="Físico (elementos)"
            fill={SERIES.first}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
          <Bar
            dataKey="financial"
            name="Financiero (valor)"
            fill={SERIES.second}
            radius={[4, 4, 0, 0]}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      <details>
        <summary>Ver datos</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Nivel</th>
              <th scope="col" className="num">
                Ejecutados
              </th>
              <th scope="col" className="num">
                Físico
              </th>
              <th scope="col" className="num">
                Presupuesto
              </th>
              <th scope="col" className="num">
                Ejecutado
              </th>
              <th scope="col" className="num">
                Financiero
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.byLevel.map((level) => (
              <tr key={level.level ?? '—'}>
                <td>{level.level ?? 'Sin nivel'}</td>
                <td className="num">
                  {formatNumber(level.done)} / {formatNumber(level.elements)}
                </td>
                <td className="num">{formatPercent(level.physicalProgress)}</td>
                <td className="num">{formatCOP(level.budget)}</td>
                <td className="num">{formatCOP(level.executedValue)}</td>
                <td className="num">{formatPercent(level.financialProgress)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

function SCurve({ summary }: { summary: ProgressSummary }) {
  if (summary.curve.length === 0) {
    return (
      <figure className="chart">
        <figcaption>Curva S de avance acumulado</figcaption>
        <p className="muted">
          Aún no hay fechas: registra avance o asigna fechas programadas en la pestaña Avance.
        </p>
      </figure>
    );
  }
  return (
    <figure className="chart">
      <figcaption>Curva S de avance acumulado (valor en COP)</figcaption>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={summary.curve} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={shortDate} minTickGap={24} />
          <YAxis
            {...axisProps}
            axisLine={false}
            domain={[0, Math.max(summary.budgetTotal, 1)]}
            tickFormatter={(v: number) => formatCOPCompact(v)}
            width={72}
          />
          <Tooltip
            content={(props) => (
              <ChartTooltip {...props} formatValue={formatCOP} formatLabel={formatIsoDate} />
            )}
          />
          <Legend {...legendProps} />
          {summary.hasPlan && (
            <Line
              type="linear"
              dataKey="planned"
              name="Programado"
              stroke={SERIES.first}
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={{ r: 4, strokeDasharray: '' }}
              activeDot={{ r: 5 }}
            />
          )}
          <Line
            type="linear"
            dataKey="executed"
            name="Ejecutado"
            stroke={SERIES.second}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {!summary.hasPlan && (
        <p className="muted small">
          Asigna fechas programadas a los elementos para ver la línea de lo programado.
        </p>
      )}
      <details>
        <summary>Ver datos</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col" className="num">
                Programado acumulado
              </th>
              <th scope="col" className="num">
                Ejecutado acumulado
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.curve.map((point) => (
              <tr key={point.date}>
                <td>{formatIsoDate(point.date)}</td>
                <td className="num">{summary.hasPlan ? formatCOP(point.planned) : '—'}</td>
                <td className="num">{formatCOP(point.executed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export function DashboardTab({ projectId, dataVersion }: Props) {
  const { state, reload } = useAsync(
    (signal) => getProgressSummary(projectId, signal),
    `${projectId}:${dataVersion}`,
  );

  if (state.status === 'loading') return <p className="muted">Calculando avance…</p>;
  if (state.status === 'error') {
    return (
      <div className="error-box card">
        <p>{state.error}</p>
        <button type="button" onClick={reload}>
          Reintentar
        </button>
      </div>
    );
  }
  const summary = state.data;
  if (summary.counts.withItem === 0) {
    return (
      <p className="muted">
        El tablero mide el avance de los elementos con ítem de presupuesto. Asigna ítems en la
        pestaña Ítems y asignación para empezar.
      </p>
    );
  }

  return (
    <div className="dashboard">
      <div className="kpi-grid">
        <Kpi
          label="Avance físico"
          value={formatPercent(summary.physicalProgress)}
          detail={`${formatNumber(summary.counts.done)} de ${formatNumber(summary.counts.withItem)} elementos ejecutados`}
        />
        <Kpi
          label="Avance financiero"
          value={formatPercent(summary.financialProgress)}
          detail={`${formatCOP(summary.executedValue)} ejecutados`}
        />
        <Kpi
          label="Presupuesto"
          value={formatCOP(summary.budgetTotal)}
          detail={`${formatCOP(summary.budgetTotal - summary.executedValue)} por ejecutar`}
        />
        <Kpi
          label="En proceso"
          value={formatNumber(summary.counts.inProgress)}
          detail="elementos (no suman al valor ejecutado hasta terminarse)"
        />
      </div>
      <StatusBar counts={summary.counts} />
      <p className="muted small">
        Físico = elementos ejecutados / elementos con ítem. Financiero = valor ejecutado /
        presupuesto. Si difieren, se está avanzando más en lo barato o en lo caro.
      </p>
      <div className="chart-grid">
        <LevelChart summary={summary} />
        <SCurve summary={summary} />
      </div>
    </div>
  );
}
