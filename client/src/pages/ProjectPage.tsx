import { MAX_MODEL_FILE_BYTES, type BulkElementsResult, type Project } from '@bim/shared';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { uploadElements } from '../api/elements';
import { downloadModelFile, getProject, uploadModelFile } from '../api/projects';
import { Link } from '../components/Link';
import { Loading } from '../components/Loading';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { formatBytes, formatNumber } from '../format';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { useModelSelection } from '../hooks/useModelSelection';
import type { BimViewer } from '../viewer/BimViewer';
import { extractFromIfc } from '../viewer/extractInBrowser';
import { getStatusMap } from '../api/progress';
import { groupGuidsByStatus, STATUS_LABELS } from '../progressLabels';
import { STATUS_COLORS } from '../viewer/BimViewer';
import { useBimViewer } from '../viewer/useBimViewer';
import { BudgetTab } from './project/BudgetTab';
import { DashboardTab } from './project/DashboardTab';
import { ProgressTab } from './project/ProgressTab';
import { ItemsTab } from './project/ItemsTab';
import { QuantitiesTab } from './project/QuantitiesTab';

type ModelStatus =
  | { kind: 'empty' }
  | { kind: 'loading' }
  | { kind: 'converting'; progress: number }
  | { kind: 'extracting' }
  | { kind: 'uploading' }
  | { kind: 'ready' }
  | { kind: 'error'; message: string };

/** Loads the stored Fragments model into the viewer whenever the project or viewer changes. */
function useStoredModel(viewer: BimViewer | null, project: Project) {
  const [status, setStatus] = useState<ModelStatus>({ kind: 'loading' });
  const fragUploadedAt = project.files.frag?.uploadedAt ?? null;
  const projectId = project.id;
  // Which model version the current viewer already shows (e.g. right after an upload).
  const shown = useRef<{ viewer: BimViewer; version: string } | null>(null);

  useEffect(() => {
    if (!viewer) return;
    if (shown.current?.viewer === viewer && shown.current.version === fragUploadedAt) return;
    const controller = new AbortController();
    const load = async () => {
      if (!fragUploadedAt) {
        setStatus({ kind: 'empty' });
        return;
      }
      setStatus({ kind: 'loading' });
      try {
        const buffer = await downloadModelFile(projectId, 'frag', controller.signal);
        if (controller.signal.aborted) return;
        await viewer.loadFragments(buffer);
        shown.current = { viewer, version: fragUploadedAt };
        setStatus({ kind: 'ready' });
      } catch (error) {
        if (!controller.signal.aborted) setStatus({ kind: 'error', message: errorMessage(error) });
      }
    };
    void load();
    return () => controller.abort();
  }, [viewer, projectId, fragUploadedAt]);

  const markShown = (version: string | undefined) => {
    if (viewer && version) shown.current = { viewer, version };
  };

  return { status, setStatus, markShown };
}

function importSummary(result: BulkElementsResult): string {
  const parts = [
    `${formatNumber(result.received)} elementos leídos del IFC`,
    `${formatNumber(result.created)} nuevos`,
    `${formatNumber(result.updated)} actualizados`,
  ];
  if (result.removed > 0) parts.push(`${formatNumber(result.removed)} marcados como eliminados`);
  return parts.join(' · ');
}

function ModelUpload({
  onFile,
  disabled,
  label,
}: {
  onFile: (file: File) => void;
  disabled: boolean;
  label: string;
}) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // allow choosing the same file again
    if (file) onFile(file);
  };
  return (
    <label className={`button-like primary ${disabled ? 'disabled' : ''}`}>
      {label}
      <input type="file" accept=".ifc" onChange={handleChange} disabled={disabled} hidden />
    </label>
  );
}

function ModelStatusOverlay({ status }: { status: ModelStatus }) {
  switch (status.kind) {
    case 'loading':
      return <div className="viewer-overlay">Cargando modelo…</div>;
    case 'converting':
      return (
        <div className="viewer-overlay">
          Procesando el IFC en el navegador… {formatNumber(Math.round(status.progress * 100))} %
        </div>
      );
    case 'extracting':
      return <div className="viewer-overlay">Extrayendo elementos y cantidades…</div>;
    case 'uploading':
      return <div className="viewer-overlay">Guardando el modelo en el servidor…</div>;
    case 'empty':
      return (
        <div className="viewer-overlay">
          Este proyecto aún no tiene modelo. Sube un archivo IFC.
        </div>
      );
    case 'error':
      return <div className="viewer-overlay error-text">{status.message}</div>;
    case 'ready':
      return null;
  }
}

type Tab = 'quantities' | 'items' | 'budget' | 'progress' | 'dashboard';

const TABS: { id: Tab; label: string }[] = [
  { id: 'quantities', label: 'Cantidades' },
  { id: 'items', label: 'Ítems y asignación' },
  { id: 'budget', label: 'Presupuesto' },
  { id: 'progress', label: 'Avance' },
  { id: 'dashboard', label: 'Tablero' },
];

function StatusLegend() {
  return (
    <ul className="viewer-legend" aria-label="Colores por estado">
      {(['PENDING', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
        <li key={s}>
          <span className="swatch" style={{ background: STATUS_COLORS[s] }} aria-hidden="true" />
          {STATUS_LABELS[s]}
        </li>
      ))}
    </ul>
  );
}

/** Current status of every element; paints the model when coloring is on. */
function useStatusColoring(
  viewer: BimViewer | null,
  projectId: number,
  dataVersion: number,
  modelReady: boolean,
) {
  const [enabled, setEnabled] = useState(false);
  const { state } = useAsync(
    (signal) => getStatusMap(projectId, signal),
    `${projectId}:${dataVersion}`,
  );
  const entries = state.status === 'success' ? state.data : null;

  useEffect(() => {
    if (!viewer || !modelReady) return;
    if (enabled && entries) void viewer.applyStatusColors(groupGuidsByStatus(entries));
    else void viewer.clearStatusColors();
  }, [viewer, modelReady, enabled, entries]);

  return { enabled, setEnabled, entries: entries ?? [] };
}

function ProjectView({
  project,
  onProjectChange,
}: {
  project: Project;
  onProjectChange: (p: Project) => void;
}) {
  const { viewer, containerRef } = useBimViewer();
  const { status, setStatus, markShown } = useStoredModel(viewer, project);
  const selection = useModelSelection(viewer);
  const [tab, setTab] = useState<Tab>('quantities');
  const [dataVersion, setDataVersion] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const busy = ['converting', 'extracting', 'uploading', 'loading'].includes(status.kind);
  const coloring = useStatusColoring(viewer, project.id, dataVersion, status.kind === 'ready');

  /** Extracts elements from the IFC and sends the full list to the API. */
  async function syncElements(ifcBytes: Uint8Array) {
    setStatus({ kind: 'extracting' });
    const extraction = await extractFromIfc(ifcBytes);
    setStatus({ kind: 'uploading' });
    const result = await uploadElements(project.id, extraction.elements);
    setNotice(importSummary(result));
    setDataVersion((v) => v + 1);
  }

  async function handleFile(file: File) {
    if (!viewer) return;
    if (!file.name.toLowerCase().endsWith('.ifc')) {
      setStatus({ kind: 'error', message: 'Selecciona un archivo con extensión .ifc.' });
      return;
    }
    if (file.size > MAX_MODEL_FILE_BYTES) {
      setStatus({
        kind: 'error',
        message: `El archivo pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_MODEL_FILE_BYTES)}.`,
      });
      return;
    }
    try {
      setNotice(null);
      setStatus({ kind: 'converting', progress: 0 });
      const ifcBytes = new Uint8Array(await file.arrayBuffer());
      const fragments = await viewer.loadIfc(ifcBytes, (progress) =>
        setStatus({ kind: 'converting', progress }),
      );
      setStatus({ kind: 'uploading' });
      await uploadModelFile(project.id, 'ifc', ifcBytes, file.name);
      const updated = await uploadModelFile(
        project.id,
        'frag',
        fragments,
        file.name.replace(/\.ifc$/i, '.frag'),
      );
      markShown(updated.files.frag?.uploadedAt);
      onProjectChange(updated);
      await syncElements(ifcBytes);
      setStatus({ kind: 'ready' });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  }

  /** Re-reads the stored IFC, e.g. for models uploaded before the extraction existed. */
  async function reextract() {
    try {
      setNotice(null);
      const ifcBytes = new Uint8Array(await downloadModelFile(project.id, 'ifc'));
      await syncElements(ifcBytes);
      setStatus({ kind: 'ready' });
    } catch (error) {
      setStatus({ kind: 'error', message: errorMessage(error) });
    }
  }

  const selectInModel = (guids: string[]) => void viewer?.selectByGuids(guids, true);
  /** Anything that changes elements, items or progress refetches the tabs' data. */
  const bumpData = () => setDataVersion((v) => v + 1);

  return (
    <div className="project-page">
      <header className="project-header">
        <div>
          <Link href="/" className="back-link">
            ← Proyectos
          </Link>
          <h2>
            {project.name}
            {project.isDemo && <span className="tag">Demo</span>}
          </h2>
          {project.description && <p className="muted">{project.description}</p>}
          {project.files.ifc && (
            <p className="meta">
              Modelo: {project.files.ifc.fileName} ({formatBytes(project.files.ifc.sizeBytes)})
            </p>
          )}
        </div>
        <div className="header-actions">
          {status.kind === 'ready' && (
            <>
              <button
                type="button"
                aria-pressed={coloring.enabled}
                className={coloring.enabled ? 'toggle on' : 'toggle'}
                onClick={() => coloring.setEnabled(!coloring.enabled)}
              >
                {coloring.enabled ? 'Quitar colores de avance' : 'Colorear por avance'}
              </button>
              <button type="button" onClick={() => void viewer?.fitToModel()}>
                Encuadrar
              </button>
            </>
          )}
          {!project.isDemo && (
            <ModelUpload
              onFile={(file) => void handleFile(file)}
              disabled={busy || !viewer}
              label={project.files.frag ? 'Reemplazar IFC' : 'Subir IFC'}
            />
          )}
        </div>
      </header>

      {notice && (
        <p className="notice" role="status">
          {notice}
          <button type="button" className="link-button" onClick={() => setNotice(null)}>
            Cerrar
          </button>
        </p>
      )}

      <div className="workspace">
        <div className="viewer-shell">
          <div ref={containerRef} className="viewer-canvas" />
          <ModelStatusOverlay status={status} />
          {coloring.enabled && status.kind === 'ready' && <StatusLegend />}
        </div>
        <aside className="side-panel card">
          <h3>Propiedades</h3>
          <PropertiesPanel
            properties={selection.properties}
            selectedCount={selection.guids.length}
            loading={selection.loadingProperties}
          />
        </aside>
      </div>

      <section className="card tabs-card">
        <div className="tabs" role="tablist">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
          <div className="tabs-actions">
            {tab === 'quantities' && project.files.ifc && !project.isDemo && (
              <button type="button" onClick={() => void reextract()} disabled={busy}>
                Volver a extraer cantidades
              </button>
            )}
          </div>
        </div>
        <div role="tabpanel">
          {tab === 'quantities' && (
            <QuantitiesTab
              projectId={project.id}
              dataVersion={dataVersion}
              selectedGuids={selection.guids}
              onSelect={selectInModel}
            />
          )}
          {tab === 'items' && (
            <ItemsTab
              projectId={project.id}
              dataVersion={dataVersion}
              selectedGuids={selection.guids}
              onDataChanged={bumpData}
            />
          )}
          {tab === 'budget' && (
            <BudgetTab projectId={project.id} dataVersion={dataVersion} onSelect={selectInModel} />
          )}
          {tab === 'progress' && (
            <ProgressTab
              projectId={project.id}
              dataVersion={dataVersion}
              selectedGuids={selection.guids}
              statusMap={coloring.entries}
              onDataChanged={bumpData}
            />
          )}
          {tab === 'dashboard' && <DashboardTab projectId={project.id} dataVersion={dataVersion} />}
        </div>
      </section>
    </div>
  );
}

export function ProjectPage({ id }: { id: number }) {
  const { state, reload, setData } = useAsync((signal) => getProject(id, signal), String(id));

  if (state.status === 'loading') return <Loading text="Cargando proyecto…" />;
  if (state.status === 'error') {
    return (
      <div className="card error-box">
        <p>{state.error}</p>
        <div className="row">
          <button type="button" onClick={reload}>
            Reintentar
          </button>
          <Link href="/">Volver a proyectos</Link>
        </div>
      </div>
    );
  }
  return <ProjectView project={state.data} onProjectChange={setData} />;
}
