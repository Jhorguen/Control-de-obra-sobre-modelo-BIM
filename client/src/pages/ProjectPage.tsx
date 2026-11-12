import { MAX_MODEL_FILE_BYTES, type BulkElementsResult, type Project } from '@bim/shared';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { uploadElements } from '../api/elements';
import { downloadModelFile, getProject, uploadModelFile } from '../api/projects';
import {
  ArrowLeftIcon,
  CloseIcon,
  FrameIcon,
  LayersIcon,
  RefreshIcon,
  UploadIcon,
} from '../components/Icon';
import { Link } from '../components/Link';
import { Loading } from '../components/Loading';
import { ProgressRibbon } from '../components/ProgressRibbon';
import { SegmentedTabs } from '../components/SegmentedTabs';
import { toast } from '../toast';
import { PropertiesPanel } from '../components/PropertiesPanel';
import { formatBytes, formatNumber } from '../format';
import { errorMessage, useAsync } from '../hooks/useAsync';
import { useModelSelection } from '../hooks/useModelSelection';
import type { BimViewer } from '../viewer/BimViewer';
import { extractFromIfc } from '../viewer/extractInBrowser';
import { getStatusMap } from '../api/progress';
import { groupGuidsByStatus, STATUS_LABELS } from '../progressLabels';
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
      <UploadIcon />
      {label}
      <input type="file" accept=".ifc" onChange={handleChange} disabled={disabled} hidden />
    </label>
  );
}

function OverlayCard({
  text,
  working,
  error,
}: {
  text: string;
  working?: boolean;
  error?: boolean;
}) {
  return (
    <div className="viewer-overlay">
      <div className={`viewer-overlay-card glass ${error ? 'error' : ''}`} role="status">
        {working && <span className="spinner" aria-hidden="true" />}
        {text}
      </div>
    </div>
  );
}

function ModelStatusOverlay({ status }: { status: ModelStatus }) {
  switch (status.kind) {
    case 'loading':
      return <OverlayCard text="Cargando modelo…" working />;
    case 'converting':
      return (
        <OverlayCard
          text={`Procesando el IFC en el navegador… ${formatNumber(Math.round(status.progress * 100))} %`}
          working
        />
      );
    case 'extracting':
      return <OverlayCard text="Extrayendo elementos y cantidades…" working />;
    case 'uploading':
      return <OverlayCard text="Guardando el modelo en el servidor…" working />;
    case 'empty':
      return <OverlayCard text="Este proyecto aún no tiene modelo. Sube un archivo IFC." />;
    case 'error':
      return <OverlayCard text={status.message} error />;
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
    <ul className="viewer-legend glass" aria-label="Colores por estado">
      {(['PENDING', 'IN_PROGRESS', 'DONE'] as const).map((s) => (
        <li key={s}>
          <span className={`swatch status-${s}`} aria-hidden="true" />
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

  // Progress is measured on elements with a budget item (same scope as the dashboard).
  const counts = { done: 0, inProgress: 0, pending: 0 };
  for (const entry of entries ?? []) {
    if (!entry.hasBudgetItem) continue;
    if (entry.status === 'DONE') counts.done++;
    else if (entry.status === 'IN_PROGRESS') counts.inProgress++;
    else counts.pending++;
  }

  return { enabled, setEnabled, entries: entries ?? [], counts };
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
  const busy = ['converting', 'extracting', 'uploading', 'loading'].includes(status.kind);
  const coloring = useStatusColoring(viewer, project.id, dataVersion, status.kind === 'ready');

  /** Extracts elements from the IFC and sends the full list to the API. */
  async function syncElements(ifcBytes: Uint8Array) {
    setStatus({ kind: 'extracting' });
    const extraction = await extractFromIfc(ifcBytes);
    setStatus({ kind: 'uploading' });
    const result = await uploadElements(project.id, extraction.elements);
    toast(importSummary(result));
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
      const message = errorMessage(error);
      setStatus({ kind: 'error', message });
      toast(message, 'error');
    }
  }

  /** Re-reads the stored IFC, e.g. for models uploaded before the extraction existed. */
  async function reextract() {
    try {
      const ifcBytes = new Uint8Array(await downloadModelFile(project.id, 'ifc'));
      await syncElements(ifcBytes);
      setStatus({ kind: 'ready' });
    } catch (error) {
      const message = errorMessage(error);
      setStatus({ kind: 'error', message });
      toast(message, 'error');
    }
  }

  const selectInModel = (guids: string[]) => void viewer?.selectByGuids(guids, true);
  /** Anything that changes elements, items or progress refetches the tabs' data. */
  const bumpData = () => setDataVersion((v) => v + 1);

  return (
    <div className="project-page">
      <header className="project-header">
        <div className="project-title">
          <Link href="/" className="back-link">
            <ArrowLeftIcon />
            Proyectos
          </Link>
          <h1>
            {project.name}
            {project.isDemo && <span className="tag">Demo</span>}
          </h1>
          {project.description && <p className="muted">{project.description}</p>}
          {project.files.ifc && (
            <div className="row">
              <span className="chip">
                {project.files.ifc.fileName} · {formatBytes(project.files.ifc.sizeBytes)}
              </span>
            </div>
          )}
        </div>
        <div className="header-actions">
          {!project.isDemo && (
            <ModelUpload
              onFile={(file) => void handleFile(file)}
              disabled={busy || !viewer}
              label={project.files.frag ? 'Reemplazar IFC' : 'Subir IFC'}
            />
          )}
        </div>
      </header>

      <ProgressRibbon counts={coloring.counts} compact />

      <div className="workbench">
        <div className="stage-column">
          <div className="viewer-shell">
            <div ref={containerRef} className="viewer-canvas" />
            <ModelStatusOverlay status={status} />
            {coloring.enabled && status.kind === 'ready' && <StatusLegend />}
            {status.kind === 'ready' && (
              <div className="viewer-toolbar glass" role="toolbar" aria-label="Vista del modelo">
                <button
                  type="button"
                  aria-pressed={coloring.enabled}
                  onClick={() => coloring.setEnabled(!coloring.enabled)}
                >
                  <LayersIcon />
                  Colores de avance
                </button>
                <button type="button" onClick={() => void viewer?.fitToModel()}>
                  <FrameIcon />
                  Encuadrar
                </button>
                {selection.guids.length > 0 && (
                  <button type="button" onClick={() => void viewer?.clearSelection()}>
                    <CloseIcon />
                    Quitar selección
                  </button>
                )}
              </div>
            )}
          </div>
          <aside className="side-panel card">
            <h2>Propiedades</h2>
            <PropertiesPanel
              properties={selection.properties}
              selectedCount={selection.guids.length}
              loading={selection.loadingProperties}
            />
          </aside>
        </div>

        <section className="card tabs-card">
          <div className="tabs-bar">
            <SegmentedTabs
              tabs={TABS}
              value={tab}
              onChange={setTab}
              label="Secciones del proyecto"
            />
            <div className="tabs-actions">
              {tab === 'quantities' && project.files.ifc && !project.isDemo && (
                <button type="button" onClick={() => void reextract()} disabled={busy}>
                  <RefreshIcon />
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
              <BudgetTab
                projectId={project.id}
                dataVersion={dataVersion}
                onSelect={selectInModel}
              />
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
            {tab === 'dashboard' && (
              <DashboardTab projectId={project.id} dataVersion={dataVersion} />
            )}
          </div>
        </section>
      </div>
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
