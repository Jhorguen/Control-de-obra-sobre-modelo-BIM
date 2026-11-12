import { useI18n } from '../i18n/useI18n';
import type { ElementProperties } from '../viewer/itemProperties';
import { ChevronRightIcon, PointerIcon } from './Icon';

interface Props {
  properties: ElementProperties | null;
  selectedCount: number;
  loading: boolean;
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{value ?? '—'}</dd>
    </div>
  );
}

export function PropertiesPanel({ properties, selectedCount, loading }: Props) {
  const { t } = useI18n();
  if (selectedCount === 0) {
    return (
      <div className="properties-empty">
        <span className="empty-icon" aria-hidden="true">
          <PointerIcon size={22} />
        </span>
        <p className="muted">{t('props.empty')}</p>
      </div>
    );
  }
  if (loading) return <p className="muted">{t('props.loading')}</p>;
  if (!properties) return <p className="muted">{t('props.notFound')}</p>;

  return (
    <div className="properties">
      {selectedCount > 1 && <p className="muted">{t('props.many', { count: selectedCount })}</p>}
      <dl className="fields">
        <Field label={t('props.ifcClass')} value={properties.ifcClass} />
        <Field label={t('props.name')} value={properties.name} />
        <Field label={t('props.type')} value={properties.typeName} />
        <Field label={t('common.level')} value={properties.level} />
        <Field label="GlobalId" value={properties.globalId} mono />
      </dl>

      {properties.groups.length === 0 && <p className="muted">{t('props.noSets')}</p>}
      {properties.groups.map((group) => (
        <details
          key={`${group.kind}-${group.name}`}
          className="property-group"
          open={group.kind === 'quantities' && group.standard}
        >
          <summary>
            <ChevronRightIcon className="chevron" size={14} />
            {group.name}
            <span className="tag">
              {group.kind === 'quantities' ? t('props.quantities') : t('props.properties')}
            </span>
          </summary>
          <table>
            <tbody>
              {group.entries.map((entry) => (
                <tr key={entry.name}>
                  <th scope="row">{entry.name}</th>
                  <td>{entry.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ))}
    </div>
  );
}
