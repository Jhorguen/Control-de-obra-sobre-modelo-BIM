import type { ProgressStatus } from '@bim/shared';
import * as OBC from '@thatopen/components';
import * as OBF from '@thatopen/components-front';
import type { FragmentsModel, ItemData } from '@thatopen/fragments';
// Self-hosted Fragments worker: Vite serves it from node_modules, no CDN involved.
import fragmentsWorkerUrl from '@thatopen/fragments/worker?url';
import * as THREE from 'three';

/** Folder where scripts/copy-wasm.mjs places web-ifc.wasm (see client/public/wasm). */
const WEB_IFC_WASM_PATH = '/wasm/';
/** The app shows one model per project, always registered under this id. */
const MODEL_ID = 'model';

export type StatusColorGroups = Record<ProgressStatus, readonly string[]>;

/**
 * Progress colors: gray pending, yellow in progress, green done. They are
 * Highlighter styles with the default priority, so the selection color (top priority)
 * paints over them and clearing a selection restores each element's status color.
 */
export const STATUS_COLORS: Record<ProgressStatus, string> = {
  PENDING: '#b5b3aa',
  IN_PROGRESS: '#fab219',
  DONE: '#0ca30c',
};
const statusStyle = (status: ProgressStatus) => `status-${status}`;
const STATUSES: ProgressStatus[] = ['PENDING', 'IN_PROGRESS', 'DONE'];

/**
 * Framing a selection never zooms in closer than this share of the whole model.
 * Framing a small element alone puts the camera inside the building: a beam under
 * the roof leaves the camera against the roof and the view filled with it.
 */
const MIN_FRAME_SHARE = 0.6;

type World = OBC.SimpleWorld<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>;

/**
 * Thin wrapper around That Open Components. React components talk to this class only,
 * so the rest of the app does not depend on the (fast-changing) viewer library API.
 */
export class BimViewer {
  private readonly components = new OBC.Components();
  private readonly world: World;
  private readonly fragments: OBC.FragmentsManager;
  private readonly highlighter: OBF.Highlighter;
  private selectionListener: ((localIds: number[]) => void) | null = null;

  constructor(container: HTMLElement) {
    const worlds = this.components.get(OBC.Worlds);
    this.world = worlds.create<OBC.SimpleScene, OBC.OrthoPerspectiveCamera, OBC.SimpleRenderer>();
    this.world.scene = new OBC.SimpleScene(this.components);
    this.world.scene.setup();
    // Transparent: the dark stage gradient of .viewer-shell (styles.css) shows through.
    this.world.scene.three.background = null;
    this.world.renderer = new OBC.SimpleRenderer(this.components, container);
    this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    this.components.init();
    // A quiet plan grid on the dark stage.
    this.components.get(OBC.Grids).create(this.world).config.color = new THREE.Color('#56616c');

    this.fragments = this.components.get(OBC.FragmentsManager);
    this.fragments.init(fragmentsWorkerUrl);

    // Fragments streams geometry by level of detail: it must know when the camera moves.
    this.world.camera.controls.addEventListener('update', () => void this.fragments.core.update());
    this.fragments.list.onItemSet.add(({ value: model }) => {
      model.useCamera(this.world.camera.three);
      this.world.scene.three.add(model.object);
      void this.fragments.core.update(true);
    });
    // Avoids z-fighting between coplanar faces (taken from the official examples).
    this.fragments.core.models.materials.list.onItemSet.add(({ value: material }) => {
      if (!('isLodMaterial' in material && material.isLodMaterial)) {
        material.polygonOffset = true;
        material.polygonOffsetUnits = 1;
        material.polygonOffsetFactor = Math.random();
      }
    });

    // Click-to-select: the raycaster finds the element, the highlighter paints it.
    this.components.get(OBC.Raycasters).get(this.world);
    this.highlighter = this.components.get(OBF.Highlighter);
    this.highlighter.setup({
      world: this.world,
      selectMaterialDefinition: {
        color: new THREE.Color('#3a8bd0'), // blueprint blue, bright enough on the dark stage
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      },
    });
    // `events` is keyed by style name; setup() creates the "select" style.
    const selectEvents = this.highlighter.events[this.highlighter.config.selectName];
    if (!selectEvents) throw new Error('Highlighter select events are not initialized');
    // Any new selection or clear ends the x-ray view of selectByGuids; selectByGuids
    // turns it back on right after its own highlight.
    selectEvents.onHighlight.add((modelIdMap) => {
      this.model?.clearGhost();
      this.selectionListener?.([...(modelIdMap[MODEL_ID] ?? [])]);
    });
    selectEvents.onClear.add(() => {
      this.model?.clearGhost();
      this.selectionListener?.([]);
    });

    for (const status of STATUSES) {
      this.highlighter.styles.set(statusStyle(status), {
        color: new THREE.Color(STATUS_COLORS[status]),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      });
    }
  }

  /** Registers the callback that receives the selected element ids (local ids). */
  onSelectionChange(listener: ((localIds: number[]) => void) | null): void {
    this.selectionListener = listener;
  }

  private get model(): FragmentsModel | undefined {
    return this.fragments.list.get(MODEL_ID);
  }

  private async removeModel(): Promise<void> {
    if (this.model) {
      await this.highlighter.clear();
      await this.fragments.core.disposeModel(MODEL_ID);
    }
  }

  /**
   * Converts an IFC file into Fragments in the browser (web-ifc runs as WebAssembly),
   * shows it and returns the Fragments binary so it can be stored on the server.
   */
  async loadIfc(data: Uint8Array, onProgress?: (progress: number) => void): Promise<ArrayBuffer> {
    await this.removeModel();
    const ifcLoader = this.components.get(OBC.IfcLoader);
    await ifcLoader.setup({
      autoSetWasm: false,
      wasm: { path: WEB_IFC_WASM_PATH, absolute: true },
    });
    const model = await ifcLoader.load(data, true, MODEL_ID, {
      processData: { progressCallback: (progress) => onProgress?.(progress) },
    });
    await this.fitToModel();
    const buffer = await model.getBuffer(false);
    return buffer instanceof ArrayBuffer ? buffer : new Uint8Array(buffer).buffer;
  }

  /** Loads a previously converted model: much faster than parsing the IFC again. */
  async loadFragments(buffer: ArrayBuffer): Promise<void> {
    await this.removeModel();
    await this.fragments.core.load(buffer, { modelId: MODEL_ID });
    await this.fitToModel();
  }

  async fitToModel(): Promise<void> {
    const model = this.model;
    if (!model) return;
    const { controls } = this.world.camera;
    // Three-quarter view from above reads better than a flat elevation. fitToSphere keeps
    // that angle (fitToBox would snap the camera back to the closest axis).
    await controls.rotateTo(Math.PI / 4, Math.PI / 3, false);
    await controls.fitToSphere(model.box.getBoundingSphere(new THREE.Sphere()), true);
    await this.fragments.core.update(true);
  }

  /** GlobalIds of the given viewer items (local ids): the link with the database records. */
  async getGuids(localIds: number[]): Promise<string[]> {
    const model = this.model;
    if (!model || localIds.length === 0) return [];
    const guids = await model.getGuidsByLocalIds(localIds);
    return guids.filter((guid): guid is string => guid !== null);
  }

  /**
   * Selects the elements with these GlobalIds, e.g. from a table row, and x-rays the
   * rest of the model so they show even behind other elements (beams under the roof,
   * footings under the floor slab). Optionally frames them.
   */
  async selectByGuids(guids: string[], zoom = true): Promise<void> {
    const model = this.model;
    if (!model) return;
    if (guids.length === 0) {
      await this.clearSelection();
      return;
    }
    const localIds = await this.localIdsOf(guids);
    await this.highlighter.highlightByID(
      this.highlighter.config.selectName,
      { [MODEL_ID]: new Set(localIds) },
      true,
      false,
    );
    if (localIds.length === 0) return;
    await model.setGhostItems(localIds, true);
    if (zoom) await this.frame(model, localIds);
    await this.fragments.core.update(true);
  }

  /** Clears the selection and, with it, the x-ray view. */
  async clearSelection(): Promise<void> {
    await this.highlighter.clear(this.highlighter.config.selectName);
    this.model?.clearGhost();
    await this.fragments.core.update(true);
  }

  /** Points the camera at the elements from the current angle, keeping a minimum distance. */
  private async frame(model: FragmentsModel, localIds: number[]): Promise<void> {
    const target = (await model.getMergedBox(localIds)).getBoundingSphere(new THREE.Sphere());
    const whole = model.box.getBoundingSphere(new THREE.Sphere());
    target.radius = Math.max(target.radius, whole.radius * MIN_FRAME_SHARE);
    await this.world.camera.controls.fitToSphere(target, true);
  }

  private async localIdsOf(guids: readonly string[]): Promise<number[]> {
    const model = this.model;
    if (!model || guids.length === 0) return [];
    const ids = await model.getLocalIdsByGuids([...guids]);
    return ids.filter((id): id is number => id !== null);
  }

  /** Paints every element with the color of its current progress status. */
  async applyStatusColors(groups: StatusColorGroups): Promise<void> {
    for (const status of STATUSES) {
      const localIds = await this.localIdsOf(groups[status]);
      if (localIds.length === 0) {
        await this.highlighter.clear(statusStyle(status));
        continue;
      }
      await this.highlighter.highlightByID(
        statusStyle(status),
        { [MODEL_ID]: new Set(localIds) },
        true,
        false,
      );
    }
  }

  async clearStatusColors(): Promise<void> {
    for (const status of STATUSES) await this.highlighter.clear(statusStyle(status));
  }

  /** Raw item data for one element: attributes plus related property sets and container. */
  async getItemData(localId: number): Promise<ItemData | null> {
    const model = this.model;
    if (!model) return null;
    const [data] = await model.getItemsData([localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        ContainedInStructure: { attributes: true, relations: false },
      },
    });
    return data ?? null;
  }

  dispose(): void {
    this.selectionListener = null;
    this.components.dispose();
  }
}
