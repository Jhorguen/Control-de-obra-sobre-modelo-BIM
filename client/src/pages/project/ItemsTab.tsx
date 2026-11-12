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
import { quantityRule, sourceLabel, unitLabel } from '../../budgetLabels';
import { PencilIcon, TrashIcon } from '../../components/Icon';
import { formatCOP, formatNumber } from '../../format';
import { Skeleton } from '../../components/Skeleton';
import { errorMessage, useAsync } from '../../hooks/useAsync';
import type { MessageKey } from '../../i18n/messages.es';
import { useI18n } from '../../i18n/useI18n';
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

/** Message for the first invalid field (the shared schema's own messages are in Spanish). */
const INVALID_FIELD: Partial<Record<string, MessageKey>> = {
  code: 'items.invalid.code',
  description: 'items.invalid.description',
  factor: 'items.invalid.factor',
  unitPrice: 'items.invalid.unitPrice',
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
  const { t } = useI18n();
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
      const field = String(parsed.error.issues[0]?.path[0] ?? '');
      setError(t(INVALID_FIELD[field] ?? 'items.invalid.other'));
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
      <h2>{item ? t('items.edit', { code: item.code }) : t('items.new')}</h2>
      <div className="form-grid">
        <label>
          {t('common.code')}
          <input
            value={form.code}
            onChange={(e) => set('code', e.target.value)}
            placeholder={t('items.codePlaceholder')}
          />
        </label>
        <label className="span-3">
          {t('common.description')}
          <input
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder={t('items.descriptionPlaceholder')}
          />
        </label>
        <label>
          {t('items.unit')}
          <select value={form.unit} onChange={(e) => changeUnit(unitSchema.parse(e.target.value))}>
            {unitSchema.options.map((unit) => (
              <option key={unit} value={unit}>
                {unitLabel(unit)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('items.source')}
          <select
            value={form.quantitySource}
            onChange={(e) => set('quantitySource', quantitySourceSchema.parse(e.target.value))}
          >
            {quantitySourceSchema.options.map((source) => (
              <option key={source} value={source}>
                {sourceLabel(source)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('items.factor')}
          <input
            type="number"
            step="any"
            min="0"
            value={form.factor}
            onChange={(e) => set('factor', e.target.value)}
          />
        </label>
        <label>
          {t('items.unitPriceCop')}
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.unitPrice}
            onChange={(e) => set('unitPrice', e.target.value)}
            placeholder={t('items.unitPricePlaceholder')}
          />
        </label>
      </div>
      <p className="muted small">
        {t('items.rule', {
          rule: quantityRule(form.quantitySource, Number(form.factor) || 0),
          unit: unitLabel(form.unit),
        })}
      </p>
      {error && <p className="error-text">{error}</p>}
      <div className="row">
        <button type="submit" className="primary" disabled={saving}>
          {saving ? t('items.saving') : item ? t('items.save') : t('items.create')}
        </button>
        {item && (
          <button type="button" onClick={onCancel}>
            {t('common.cancel')}
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
  const { t, tp } = useI18n();
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
      const params = { code: chosen.code, count: formatNumber(affected) };
      const done =
        action === 'assign'
          ? tp('items.assigned', affected, params)
          : tp('items.unassigned', affected, params);
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
        {count === 0
          ? t('common.noSelection')
          : tp('common.selected', count, { count: formatNumber(count) })}
      </strong>
      <select
        value={chosen?.id ?? ''}
        onChange={(e) => setItemId(Number(e.target.value))}
        disabled={items.length === 0}
        aria-label={t('items.itemToAssign')}
      >
        {items.length === 0 && <option value="">{t('items.createFirst')}</option>}
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
        {t('items.assign')}
      </button>
      <button
        type="button"
        onClick={() => void run('unassign')}
        disabled={busy || count === 0 || !chosen}
      >
        {t('items.unassign')}
      </button>
      <span className="muted small">{message ?? t('items.hint')}</span>
    </div>
  );
}

export function ItemsTab({ projectId, dataVersion, selectedGuids, onDataChanged }: Props) {
  const { state, reload } = useAsync(
    (signal) => listBudgetItems(projectId, signal),
    `${projectId}:${dataVersion}`,
  );
  const [editing, setEditing] = useState<BudgetItem | null>(null);
  const { t } = useI18n();

  async function handleDelete(item: BudgetItem) {
    if (!window.confirm(t('items.deleteConfirm', { code: item.code }))) return;
    try {
      await deleteBudgetItem(item.id);
      if (editing?.id === item.id) setEditing(null);
      onDataChanged();
    } catch (err) {
      window.alert(errorMessage(err));
    }
  }

  if (state.status === 'loading') return <Skeleton label={t('items.loading')} rows={6} />;
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
        <p className="muted">{t('items.empty')}</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">{t('common.code')}</th>
                <th scope="col">{t('common.description')}</th>
                <th scope="col">{t('common.unitShort')}</th>
                <th scope="col">{t('items.source')}</th>
                <th scope="col" className="num">
                  {t('common.unitPrice')}
                </th>
                <th scope="col">
                  <span className="visually-hidden">{t('items.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={editing?.id === item.id ? 'selected' : ''}>
                  <td>{item.code}</td>
                  <td className="wrap">{item.description}</td>
                  <td>{unitLabel(item.unit)}</td>
                  <td>{quantityRule(item.quantitySource, item.factor)}</td>
                  <td className="num">{formatCOP(item.unitPrice)}</td>
                  <td className="actions">
                    <div className="row">
                      <button
                        type="button"
                        className="icon-only"
                        onClick={() => setEditing(item)}
                        aria-label={t('items.editLabel', { code: item.code })}
                        title={t('common.edit')}
                      >
                        <PencilIcon />
                      </button>
                      <button
                        type="button"
                        className="danger icon-only"
                        onClick={() => void handleDelete(item)}
                        aria-label={t('items.deleteLabel', { code: item.code })}
                        title={t('common.delete')}
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
