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
    this.world.scene.three.background = new THREE.Color('#eef1f5');
    this.world.renderer = new OBC.SimpleRenderer(this.components, container);
    this.world.camera = new OBC.OrthoPerspectiveCamera(this.components);
    this.components.init();
    this.components.get(OBC.Grids).create(this.world);

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
        color: new THREE.Color('#1f5fbf'),
        opacity: 1,
        transparent: false,
        renderedFaces: 0,
      },
    });
    // `events` is keyed by style name; setup() creates the "select" style.
    const selectEvents = this.highlighter.events[this.highlighter.config.selectName];
    if (!selectEvents) throw new Error('Highlighter select events are not initialized');
    selectEvents.onHighlight.add((modelIdMap) => {
      this.selectionListener?.([...(modelIdMap[MODEL_ID] ?? [])]);
    });
    selectEvents.onClear.add(() => this.selectionListener?.([]));
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
    // Three-quarter view from above reads better than a flat elevation.
    await controls.rotateTo(Math.PI / 4, Math.PI / 3, false);
    await controls.fitToBox(model.box, true);
    await this.fragments.core.update(true);
  }

  /** Raw item data for one element: attributes plus related property sets and container. */
  async getItemData(localId: number): Promise<ItemData | null> {
    const model = this.model;
    if (!model) return null;
    const [data] = await model.getItemsData([localId], {
      attributesDefault: true,
      relations: {
        IsDefinedBy: { attributes: true, relations: true },
        IsTypedBy: { attributes: true, relations: false },
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
