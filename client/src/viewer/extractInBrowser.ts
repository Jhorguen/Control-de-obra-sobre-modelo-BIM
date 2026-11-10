import { extractElementsFromBytes, type ExtractionResult } from '@bim/shared/extraction';
import { IfcAPI } from 'web-ifc';

// The extraction logic lives in @bim/shared/extraction so the same code runs here, in the
// browser, and in Node (tests and the demo seed). This file only sets up web-ifc for the web.

let apiPromise: Promise<IfcAPI> | null = null;

function getIfcApi(): Promise<IfcAPI> {
  apiPromise ??= (async () => {
    const api = new IfcAPI();
    api.SetWasmPath('/wasm/', true); // served from client/public/wasm (scripts/copy-wasm.mjs)
    await api.Init();
    return api;
  })();
  return apiPromise;
}

/** Reads elements and quantities from the IFC bytes (parsed in the browser, never on the server). */
export async function extractFromIfc(bytes: Uint8Array): Promise<ExtractionResult> {
  const api = await getIfcApi();
  return extractElementsFromBytes(api, bytes);
}
