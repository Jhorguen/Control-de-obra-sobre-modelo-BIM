import type { QuantitiesResponse, QuantityGroup, QuantitySums } from '@bim/shared';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { formatNumber, formatQuantity } from '../format';
import { useI18n } from '../i18n/useI18n';
import { ifcClassLabel } from '../ifcClasses';

interface Props {
  data: QuantitiesResponse;
  selectedGuids: readonly string[];
  onSelect: (guids: string[]) => void;
}

/** A sum that ignores elements without the quantity is flagged so nobody reads it as complete. */
function QuantityCell({ sums, kind }: { sums: QuantitySums; kind: 'volume' | 'area' | 'length' }) {
  const { t, tp } = useI18n();
  const missing =
    kind === 'volume'
      ? sums.withoutVolume
      : kind === 'area'
        ? sums.withoutArea
        : sums.withoutLength;
  if (missing === sums.count) {
    return (
      <td className="num muted" title={t('qty.missing')}>
        —
      </td>
    );
  }
  return (
    <td className="num">
      {formatQuantity(sums[kind])}
      {missing > 0 && (
        <abbr
          className="partial"
          title={tp('qty.partial', missing, { count: formatNumber(missing) })}
        >
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
  const { t } = useI18n();
  const selected = new Set(selectedGuids);
  const isSelected = (group: QuantityGroup) => group.globalIds.some((guid) => selected.has(guid));
  const firstSelectedRow = useRef<HTMLTableRowElement | null>(null);

  // When an element is picked in the model, bring its row into view.
  const firstSelectedGroup = data.groups.find(isSelected);
  useEffect(() => {
    firstSelectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [firstSelectedGroup]);

  if (data.groups.length === 0) {
    return <p className="muted">{t('qty.empty')}</p>;
  }

  return (
    <>
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">{t('qty.classType')}</th>
              <th scope="col">{t('common.level')}</th>
              <th scope="col" className="num">
                {t('common.elements')}
              </th>
              <th scope="col" className="num">
                {t('qty.volume')}
              </th>
              <th scope="col" className="num">
                {t('qty.area')}
              </th>
              <th scope="col" className="num">
                {t('qty.length')}
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
                        {group.typeName ?? <span className="muted">{t('common.noType')}</span>}
                      </td>
                      <td>{group.level ?? <span className="muted">{t('common.noLevel')}</span>}</td>
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
                {t('qty.total')}
              </th>
              <td className="num">{formatNumber(data.totals.count)}</td>
              <QuantityCell sums={data.totals} kind="volume" />
              <td colSpan={2} className="muted small">
                {t('qty.totalNote')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="muted small table-note">{t('qty.note')}</p>
    </>
  );
}
