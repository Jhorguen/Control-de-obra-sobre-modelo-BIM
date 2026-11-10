import type { ElementProperties } from '../viewer/itemProperties';

interface Props {
  properties: ElementProperties | null;
  selectedCount: number;
  loading: boolean;
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="field">
      <dt>{label}</dt>
      <dd>{value ?? '—'}</dd>
    </div>
  );
}

export function PropertiesPanel({ properties, selectedCount, loading }: Props) {
  if (selectedCount === 0) {
    return (
      <p className="muted">
        Haz clic en un elemento del modelo para ver sus propiedades. Con Ctrl + clic seleccionas
        varios.
      </p>
    );
  }
  if (loading) return <p className="muted">Cargando propiedades…</p>;
  if (!properties) return <p className="muted">No se encontraron propiedades.</p>;

  return (
    <div className="properties">
      {selectedCount > 1 && (
        <p className="muted">{selectedCount} elementos seleccionados. Se muestra el primero.</p>
      )}
      <dl className="fields">
        <Field label="Clase IFC" value={properties.ifcClass} />
        <Field label="Nombre" value={properties.name} />
        <Field label="Tipo" value={properties.typeName} />
        <Field label="Nivel" value={properties.level} />
        <Field label="GlobalId" value={properties.globalId} />
      </dl>

      {properties.groups.length === 0 && (
        <p className="muted">El elemento no tiene conjuntos de propiedades.</p>
      )}
      {properties.groups.map((group) => (
        <details
          key={`${group.kind}-${group.name}`}
          className="property-group"
          open={group.kind === 'quantities' && group.standard}
        >
          <summary>
            {group.name}
            <span className="tag">
              {group.kind === 'quantities' ? 'Cantidades' : 'Propiedades'}
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
