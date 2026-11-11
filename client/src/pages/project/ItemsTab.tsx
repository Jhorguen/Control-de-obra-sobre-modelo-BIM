import {
  budgetItemInputSchema,
  DEFAULT_SOURCE_BY_UNIT,
  quantitySourceSchema,
  unitSchema,
  type BudgetItem,
  type QuantitySource,
  type Unit,
} from '@bim/shared';
import { useState, type FormEvent } from 'react';
import {
  assignBudgetItem,
  createBudgetItem,
  deleteBudgetItem,
  listBudgetItems,
  unassignBudgetItem,
  updateBudgetItem,
} from '../../api/budget';
import { quantityRule, SOURCE_LABELS, UNIT_LABELS } from '../../budgetLabels';
import { PencilIcon, TrashIcon } from '../../components/Icon';
import { formatCOP, formatNumber } from '../../format';
import { Skeleton } from '../../components/Skeleton';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import { toast } from '../../toast';

interface Props {
  projectId: number;
  dataVersion: number;
  selectedGuids: readonly string[];
  onDataChanged: () => void;
}

interface FormState {
  code: string;
  description: string;
  unit: Unit;
  quantitySource: QuantitySource;
  factor: string;
  unitPrice: string;
}

const emptyForm: FormState = {
  code: '',
  description: '',
  unit: 'M3',
  quantitySource: 'VOLUME',
  factor: '1',
  unitPrice: '',
};

function toForm(item: BudgetItem): FormState {
  return { ...item, factor: String(item.factor), unitPrice: String(item.unitPrice) };
}

function BudgetItemForm({
  projectId,
  item,
  onSaved,
  onCancel,
}: {
  projectId: number;
  item: BudgetItem | null;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<FormState>(item ? toForm(item) : emptyForm);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  function changeUnit(unit: Unit) {
    // Keep a custom source, but follow the unit when the source was still the default one.
    setForm((f) => ({
      ...f,
      unit,
      quantitySource:
        f.quantitySource === DEFAULT_SOURCE_BY_UNIT[f.unit]
          ? DEFAULT_SOURCE_BY_UNIT[unit]
          : f.quantitySource,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Same Zod schema the server uses: errors show up before the request is sent.
    const parsed = budgetItemInputSchema.safeParse({
      ...form,
      factor: Number(form.factor),
      unitPrice: form.unitPrice === '' ? Number.NaN : Number(form.unitPrice),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisa los datos del ítem.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (item) await updateBudgetItem(item.id, parsed.data);
      else await createBudgetItem(projectId, parsed.data);
      if (!item) setForm(emptyForm);
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="item-form" onSubmit={handleSubmit}>
      <h2>{item ? `Editar ítem ${item.code}` : 'Nuevo ítem'}</h2>
      <div className="form-grid">
        <label>
          Código
          <input
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder="Ej. 2.1"
          />
        </label>
        <label className="span-3">
          Descripción
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Ej. Concreto 3000 psi para muros"
          />
        </label>
        <label>
          Unidad
          <select value={form.unit} onChange={(e) => changeUnit(unitSchema.parse(e.target.value))}>
            {unitSchema.options.map((unit) => (
              <option key={unit} value={unit}>
                {UNIT_LABELS[unit]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cantidad desde
          <select
            value={form.quantitySource}
            onChange={(e) => set('quantitySource', quantitySourceSchema.parse(e.target.value))}
          >
            {quantitySourceSchema.options.map((source) => (
              <option key={source} value={source}>
                {SOURCE_LABELS[source]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Factor
          <input
            type="number"
            step="any"
            min="0"
            value={form.factor}
            onChange={(e) => set('factor', e.target.value)}
          />
        </label>
        <label>
          Precio unitario (COP)
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.unitPrice}
            onChange={(e) => set('unitPrice', e.target.value)}
            placeholder="Ej. 450000"
          />
        </label>
      </div>
      <p className="muted small">
        Cantidad por elemento = {quantityRule(form.quantitySource, Number(form.factor) || 0)} (
        {UNIT_LABELS[form.unit]}). Ej.: acero de refuerzo en kg = volumen × 90 kg/m³; formaleta a
        dos caras = área × 2.
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? 'Guardando…' : item ? 'Guardar cambios' : 'Crear ítem'}
        </button>
        {item && (
          <button type="button" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function AssignmentBar({
  projectId,
  items,
  selectedGuids,
  onDone,
}: {
  projectId: number;
  items: BudgetItem[];
  selectedGuids: readonly string[];
  onDone: () => void;
}) {
  const [itemId, setItemId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const chosen = items.find((i) => i.id === itemId) ?? items[0];
  const count = selectedGuids.length;

  async function run(action: 'assign' | 'unassign') {
    if (!chosen || count === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      const fn = action === 'assign' ? assignBudgetItem : unassignBudgetItem;
      const { affected } = await fn(projectId, selectedGuids, chosen.id);
      const done =
        action === 'assign'
          ? `Ítem ${chosen.code} asignado a ${formatNumber(affected)} elemento(s).`
          : `Ítem ${chosen.code} quitado de ${formatNumber(affected)} elemento(s).`;
      setMessage(done);
      toast(done);
      onDone();
    } catch (err) {
      const failed = errorMessage(err);
      setMessage(failed);
      toast(failed, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="assign-bar">
      <strong>
        {count === 0 ? 'Sin selección' : `${formatNumber(count)} elemento(s) seleccionado(s)`}
      </strong>
      <select
        value={chosen?.id ?? ''}
        onChange={(e) => setItemId(Number(e.target.value))}
        disabled={items.length === 0}
        aria-label="Ítem a asignar"
      >
        {items.length === 0 && <option value="">Primero crea un ítem</option>}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.code} — {item.description}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="primary"
        onClick={() => void run('assign')}
        disabled={busy || count === 0 || !chosen}
      >
        Asignar
      </button>
      <button
        type="button"
        onClick={() => void run('unassign')}
        disabled={busy || count === 0 || !chosen}
      >
        Quitar
      </button>
      <span className="muted small">
        {message ??
          'Selecciona elementos en el modelo (Ctrl + clic para varios) o una fila de Cantidades, p. ej. un tipo de muro.'}
      </span>
    </div>
  );
}

export function ItemsTab({ projectId, dataVersion, selectedGuids, onDataChanged }: Props) {
  const { state, reload } = useAsync(
    (signal) => listBudgetItems(projectId, signal),
    `${projectId}:${dataVersion}`,
  );
  const [editing, setEditing] = useState<BudgetItem | null>(null);

  async function handleDelete(item: BudgetItem) {
    if (!window.confirm(`¿Eliminar el ítem ${item.code}? Se quitará de todos sus elementos.`))
      return;
    try {
      await deleteBudgetItem(item.id);
      if (editing?.id === item.id) setEditing(null);
      onDataChanged();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  if (state.status === 'loading') return <Skeleton label="Cargando ítems" rows={6} />;
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
  const items = state.data;

  return (
    <div className="items-tab">
      <AssignmentBar
        projectId={projectId}
        items={items}
        selectedGuids={selectedGuids}
        onDone={onDataChanged}
      />
      <BudgetItemForm
        key={editing?.id ?? 'new'}
        projectId={projectId}
        item={editing}
        onSaved={() => {
          setEditing(null);
          onDataChanged();
        }}
        onCancel={() => setEditing(null)}
      />
      {items.length === 0 ? (
        <p className="muted">
          Aún no hay ítems. Crea el primero con el formulario (el precio unitario sale del APU).
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Código</th>
                <th scope="col">Descripción</th>
                <th scope="col">Und</th>
                <th scope="col">Cantidad desde</th>
                <th scope="col" className="num">
                  Precio unitario
                </th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={editing?.id === item.id ? 'selected' : ''}>
                  <td>{item.code}</td>
                  <td className="wrap">{item.description}</td>
                  <td>{UNIT_LABELS[item.unit]}</td>
                  <td>{quantityRule(item.quantitySource, item.factor)}</td>
                  <td className="num">{formatCOP(item.unitPrice)}</td>
                  <td className="actions">
                    <div className="row">
                      <button
                        type="button"
                        className="icon-only"
                        onClick={() => setEditing(item)}
                        aria-label={`Editar el ítem ${item.code}`}
                        title="Editar"
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="danger icon-only"
                        onClick={() => void handleDelete(item)}
                        aria-label={`Eliminar el ítem ${item.code}`}
                        title="Eliminar"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
