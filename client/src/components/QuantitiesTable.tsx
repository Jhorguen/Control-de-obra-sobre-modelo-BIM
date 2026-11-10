import type { QuantitiesResponse, QuantityGroup, QuantitySums } from '@bim/shared';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatNumber, formatQuantity } from '../format';
import { ifcClassLabel } from '../ifcClasses';

interface Props {
  data: QuantitiesResponse;
  selectedGuids: readonly string[];
  onSelect: (guids: string[]) => void;
}

/** A sum that ignores elements without the quantity is flagged so nobody reads it as complete. */
function QuantityCell({ sums, kind }: { sums: QuantitySums; kind: 'volume' | 'area' | 'length' }) {
  const missing =
    kind === 'volume'
      ? sums.withoutVolume
      : kind === 'area'
        ? sums.withoutArea
        : sums.withoutLength;
  if (missing === sums.count) {
    return (
      <td className="num muted" title="El IFC no trae esta cantidad">
        —
      </td>
    );
  }
  return (
    <td className="num">
      {formatQuantity(sums[kind])}
      {missing > 0 && (
        <abbr className="partial" title={`${missing} elemento(s) sin esta cantidad en el IFC`}>
          *
        </abbr>
      )}
    </td>
  );
}

function selectOnKey(event: KeyboardEvent, select: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    select();
  }
}

export function QuantitiesTable({ data, selectedGuids, onSelect }: Props) {
  const selected = new Set(selectedGuids);
  const isSelected = (group: QuantityGroup) => group.globalIds.some((guid) => selected.has(guid));
  const firstSelectedRow = useRef<HTMLTableRowElement | null>(null);

  // When an element is picked in the model, bring its row into view.
  const firstSelectedGroup = data.groups.find(isSelected);
  useEffect(() => {
    firstSelectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [firstSelectedGroup]);

  if (data.groups.length === 0) {
    return <p className="muted">No hay elementos. Sube un IFC para obtener las cantidades.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th scope="col">Clase / tipo</th>
            <th scope="col">Nivel</th>
            <th scope="col" className="num">
              Elementos
            </th>
            <th scope="col" className="num">
              Volumen (m³)
            </th>
            <th scope="col" className="num">
              Área (m²)
            </th>
            <th scope="col" className="num">
              Longitud (m)
            </th>
          </tr>
        </thead>
        <tbody>
          {data.classTotals.map((classTotal) => {
            const groups = data.groups.filter((g) => g.ifcClass === classTotal.ifcClass);
            const classGuids = groups.flatMap((g) => g.globalIds);
            const selectClass = () => onSelect(classGuids);
            return [
              <tr
                key={classTotal.ifcClass}
                className="class-row clickable"
                tabIndex={0}
                onClick={selectClass}
                onKeyDown={(e) => selectOnKey(e, selectClass)}
              >
                <th scope="row" colSpan={2}>
                  {ifcClassLabel(classTotal.ifcClass)}{' '}
                  <span className="ifc-class">{classTotal.ifcClass}</span>
                </th>
                <td className="num">{formatNumber(classTotal.count)}</td>
                <QuantityCell sums={classTotal} kind="volume" />
                <QuantityCell sums={classTotal} kind="area" />
                <QuantityCell sums={classTotal} kind="length" />
              </tr>,
              ...groups.map((group) => {
                const rowSelected = isSelected(group);
                const selectGroup = () => onSelect(group.globalIds);
                return (
                  <tr
                    key={`${group.ifcClass}|${group.typeName}|${group.level}`}
                    ref={group === firstSelectedGroup ? firstSelectedRow : undefined}
                    className={`clickable ${rowSelected ? 'selected' : ''}`}
                    tabIndex={0}
                    aria-selected={rowSelected}
                    onClick={selectGroup}
                    onKeyDown={(e) => selectOnKey(e, selectGroup)}
                  >
                    <td className="indent">
                      {group.typeName ?? <span className="muted">Sin tipo</span>}
                    </td>
                    <td>{group.level ?? <span className="muted">Sin nivel</span>}</td>
                    <td className="num">{formatNumber(group.count)}</td>
                    <QuantityCell sums={group} kind="volume" />
                    <QuantityCell sums={group} kind="area" />
                    <QuantityCell sums={group} kind="length" />
                  </tr>
                );
              }),
            ];
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" colSpan={2}>
              Total del modelo
            </th>
            <td className="num">{formatNumber(data.totals.count)}</td>
            <QuantityCell sums={data.totals} kind="volume" />
            <td colSpan={2} className="muted small">
              Áreas y longitudes solo se suman por clase.
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="muted small">
        Clic en una fila para ver esos elementos en el modelo. * Algunos elementos no traen esa
        cantidad en el IFC y no se suman (no se inventan valores).
      </p>
    </div>
  );
}
