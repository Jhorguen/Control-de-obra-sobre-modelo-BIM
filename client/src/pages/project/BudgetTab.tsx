import type { ElementGroup } from '@bim/shared';
import { getBudget } from '../../api/budget';
import { UNIT_LABELS } from '../../budgetLabels';
import { formatCOP, formatNumber, formatQuantity } from '../../format';
import { Skeleton } from '../../components/Skeleton';
import { useAsync } from '../../hooks/useAsync';
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
  return (
    <div className={`left-out card ${group.count > 0 ? 'warn' : ''}`}>
      <div className="row space-between">
        <h2>
          {title} ({formatNumber(group.count)})
        </h2>
        {group.count > 0 && (
          <button type="button" onClick={() => onSelect(group.globalIds)}>
            Ver en el modelo
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
  const { state, reload } = useAsync(
    (signal) => getBudget(projectId, signal),
    `${projectId}:${dataVersion}`,
  );

  if (state.status === 'loading') return <Skeleton label="Calculando presupuesto" rows={8} />;
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
  const budget = state.data;

  return (
    <div className="budget-tab">
      {budget.lines.length === 0 ? (
        <p className="muted">
          No hay ítems de presupuesto. Créalos en la pestaña Ítems y asígnalos a los elementos del
          modelo.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Und</th>
                <th scope="col" className="num">
                  Elementos
                </th>
                <th scope="col" className="num">
                  Cantidad
                </th>
                <th scope="col" className="num">
                  Precio unitario
                </th>
                <th scope="col" className="num">
                  Subtotal
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
                  <td>{UNIT_LABELS[line.item.unit]}</td>
                  <td className="num">
                    {formatNumber(line.elementCount)}
                    {line.withoutQuantity > 0 && (
                      <abbr
                        className="partial"
                        title={`${line.withoutQuantity} elemento(s) sin la cantidad que necesita este ítem`}
                      >
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
                  Total presupuesto
                </th>
                <td className="num">{formatCOP(budget.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="left-out-grid">
        <LeftOutGroup
          title="Elementos sin ítem asignado"
          description="No suman al presupuesto hasta que se les asigne un ítem."
          group={budget.unassigned}
          onSelect={onSelect}
        />
        <LeftOutGroup
          title="Elementos sin cantidad"
          description="Tienen ítem, pero el IFC no trae la cantidad que el ítem necesita; no se inventan valores."
          group={budget.withoutQuantity}
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}
