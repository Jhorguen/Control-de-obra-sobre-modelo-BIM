import type { ElementGroup } from '@bim/shared';
import { getBudget } from '../../api/budget';
import { unitLabel } from '../../budgetLabels';
import { formatCOP, formatNumber, formatQuantity } from '../../format';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';
import { useI18n } from '../../i18n/useI18n';
import { ifcClassLabel } from '../../ifcClasses';

interface Props {
  projectId: number;
  dataVersion: number;
  onSelect: (guids: string[]) => void;
}

function LeftOutGroup({
  title,
  description,
  group,
  onSelect,
}: {
  title: string;
  description: string;
  group: ElementGroup;
  onSelect: (guids: string[]) => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`left-out card ${group.count > 0 ? 'warn' : ''}`}>
      <div className="row space-between">
        <h2>
          {title} ({formatNumber(group.count)})
        </h2>
        {group.count > 0 && (
          <button type="button" onClick={() => onSelect(group.globalIds)}>
            {t('budget.showInModel')}
          </button>
        )}
      </div>
      <p className="muted small">{description}</p>
      {group.byClass.length > 0 && (
        <ul className="inline-list">
          {group.byClass.map((c) => (
            <li key={c.ifcClass}>
              {ifcClassLabel(c.ifcClass)}: {formatNumber(c.count)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BudgetTab({ projectId, dataVersion, onSelect }: Props) {
  const { t, tp } = useI18n();
  const { state, reload } = useAsync(
    (signal) => getBudget(projectId, signal),
    `${projectId}:${dataVersion}`,
  );

  if (state.status === 'loading') return <Skeleton label={t('budget.loading')} rows={8} />;
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
  const budget = state.data;

  return (
    <div className="budget-tab">
      {budget.lines.length === 0 ? (
        <p className="muted">{t('budget.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('common.code')}</th>
                <th scope="col">{t('common.description')}</th>
                <th scope="col">{t('common.unitShort')}</th>
                <th scope="col" className="num">
                  {t('common.elements')}
                </th>
                <th scope="col" className="num">
                  {t('budget.quantity')}
                </th>
                <th scope="col" className="num">
                  {t('common.unitPrice')}
                </th>
                <th scope="col" className="num">
                  {t('budget.subtotal')}
                </th>
              </tr>
            </thead>
            <tbody>
              {budget.lines.map((line) => (
                <tr
                  key={line.item.id}
                  className="clickable"
                  tabIndex={0}
                  onClick={() => onSelect(line.globalIds)}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(line.globalIds)}
                >
                  <td>{line.item.code}</td>
                  <td className="wrap">{line.item.description}</td>
                  <td>{unitLabel(line.item.unit)}</td>
                  <td className="num">
                    {formatNumber(line.elementCount)}
                    {line.withoutQuantity > 0 && (
                      <abbr className="partial" title={tp('budget.partial', line.withoutQuantity)}>
                        *
                      </abbr>
                    )}
                  </td>
                  <td className="num">{formatQuantity(line.quantity)}</td>
                  <td className="num">{formatCOP(line.item.unitPrice)}</td>
                  <td className="num">{formatCOP(line.subtotal)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={6}>
                  {t('budget.total')}
                </th>
                <td className="num">{formatCOP(budget.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="left-out-grid">
        <LeftOutGroup
          title={t('budget.unassigned')}
          description={t('budget.unassignedNote')}
          group={budget.unassigned}
          onSelect={onSelect}
        />
        <LeftOutGroup
          title={t('budget.withoutQuantity')}
          description={t('budget.withoutQuantityNote')}
          group={budget.withoutQuantity}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
