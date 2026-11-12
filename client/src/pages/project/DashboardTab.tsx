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
  formatShortDate,
} from '../../format';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useI18n } from '../../i18n/useI18n';

// Chart styling follows the data-viz rules used across the app: two categorical slots
// validated for color-vision deficiency (blue, orange), thin marks, recessive grid and
// axes, a legend for every multi-series chart, hover tooltips and a data table.
const SERIES = { first: '#2a78d6', second: '#eb6834' };
// Chart chrome from the app's tokens (styles.css): ink, muted ink, hairline, baseline.
const INK = { text: '#1d2125', muted: '#5f666d', grid: '#dedbd4', axis: '#c9c5bc' };
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

function Kpi({
  label,
  value,
  detail,
  meter,
}: {
  label: string;
  value: string;
  detail: string;
  /** Ratio drawn under the value, in the color of its series in the charts. */
  meter?: { ratio: number; color: string };
}) {
  return (
    <div className="kpi">
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      {meter && (
        <div className="kpi-meter" aria-hidden="true">
          <span style={{ width: `${Math.min(1, meter.ratio) * 100}%`, background: meter.color }} />
        </div>
      )}
      <span className="kpi-detail">{detail}</span>
    </div>
  );
}

function LevelChart({ summary }: { summary: ProgressSummary }) {
  const { t } = useI18n();
  const data = summary.byLevel.map((level) => ({
    level: level.level ?? t('common.noLevel'),
    physical: level.physicalProgress,
    financial: level.financialProgress,
  }));
  return (
    <figure className="chart">
      <figcaption>{t('dash.byLevel')}</figcaption>
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
            name={t('dash.physicalSeries')}
            fill={SERIES.first}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={40}
          />
          <Bar
            dataKey="financial"
            name={t('dash.financialSeries')}
            fill={SERIES.second}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
            maxBarSize={40}
          />
        </BarChart>
      </ResponsiveContainer>
      <details>
        <summary>{t('dash.showData')}</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('common.level')}</th>
              <th scope="col" className="num">
                {t('dash.doneCount')}
              </th>
              <th scope="col" className="num">
                {t('dash.physicalShort')}
              </th>
              <th scope="col" className="num">
                {t('dash.budget')}
              </th>
              <th scope="col" className="num">
                {t('dash.executed')}
              </th>
              <th scope="col" className="num">
                {t('dash.financialShort')}
              </th>
            </tr>
          </thead>
          <tbody>
            {summary.byLevel.map((level) => (
              <tr key={level.level ?? '—'}>
                <td>{level.level ?? t('common.noLevel')}</td>
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
  const { t } = useI18n();
  if (summary.curve.length === 0) {
    return (
      <figure className="chart">
        <figcaption>{t('dash.curve')}</figcaption>
        <p className="muted">{t('dash.noDates')}</p>
      </figure>
    );
  }
  return (
    <figure className="chart">
      <figcaption>{t('dash.curveCop')}</figcaption>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={summary.curve} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={INK.grid} />
          <XAxis dataKey="date" {...axisProps} tickFormatter={formatShortDate} minTickGap={24} />
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
              name={t('dash.planned')}
              stroke={SERIES.first}
              strokeWidth={2}
              isAnimationActive={false}
              strokeDasharray="6 4"
              dot={{ r: 4, strokeDasharray: '' }}
              activeDot={{ r: 5 }}
            />
          )}
          <Line
            type="linear"
            dataKey="executed"
            name={t('dash.executed')}
            stroke={SERIES.second}
            strokeWidth={2}
            isAnimationActive={false}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
      {!summary.hasPlan && <p className="muted small">{t('dash.noPlan')}</p>}
      <details>
        <summary>{t('dash.showData')}</summary>
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('common.date')}</th>
              <th scope="col" className="num">
                {t('dash.plannedCumulative')}
              </th>
              <th scope="col" className="num">
                {t('dash.executedCumulative')}
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
  const { t } = useI18n();
  const { state, reload } = useAsync(
    (signal) => getProgressSummary(projectId, signal),
    `${projectId}:${dataVersion}`,
  );

  if (state.status === 'loading') return <Skeleton label={t('dash.loading')} rows={6} />;
  if (state.status === 'error') {
    return (
      <div className="error-box card">
        <p>{state.error}</p>
        <button type="button" onClick={reload}>
          {t('common.retry')}
        </button>
      </div>
    );
  }
  const summary = state.data;
  if (summary.counts.withItem === 0) {
    return <p className="muted">{t('dash.noItems')}</p>;
  }

  return (
    <div className="dashboard">
      <div className="kpi-grid">
        <Kpi
          label={t('dash.physical')}
          value={formatPercent(summary.physicalProgress)}
          meter={{ ratio: summary.physicalProgress, color: SERIES.first }}
          detail={t('dash.physicalDetail', {
            done: formatNumber(summary.counts.done),
            total: formatNumber(summary.counts.withItem),
          })}
        />
        <Kpi
          label={t('dash.financial')}
          value={formatPercent(summary.financialProgress)}
          meter={{ ratio: summary.financialProgress, color: SERIES.second }}
          detail={t('dash.financialDetail', { value: formatCOP(summary.executedValue) })}
        />
        <Kpi
          label={t('dash.budget')}
          value={formatCOP(summary.budgetTotal)}
          detail={t('dash.budgetDetail', {
            value: formatCOP(summary.budgetTotal - summary.executedValue),
          })}
        />
        <Kpi
          label={t('dash.inProgress')}
          value={formatNumber(summary.counts.inProgress)}
          detail={t('dash.inProgressDetail')}
        />
      </div>
      <p className="muted small">{t('dash.explain')}</p>
      <div className="chart-grid">
        <LevelChart summary={summary} />
        <SCurve summary={summary} />
      </div>
    </div>
  );
}
