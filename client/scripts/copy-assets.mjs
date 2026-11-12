// Copies files the app serves at stable URLs into public/ (both folders are gitignored):
// - web-ifc.wasm → public/wasm/. The IFC importer needs a folder path, not a
//   bundler-hashed file, and copying from node_modules guarantees the .wasm matches
//   the installed JS version.
// - the sample IFC models of samples/ → public/samples/, so testers can download them
//   from the deployed app (client/vercel.json serves them as downloads).
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const clientDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const wasmDir = join(clientDir, 'public', 'wasm');
mkdirSync(wasmDir, { recursive: true });
copyFileSync(require.resolve('web-ifc/web-ifc.wasm'), join(wasmDir, 'web-ifc.wasm'));

const samplesSource = join(clientDir, '..', 'samples');
const samplesDir = join(clientDir, 'public', 'samples');
mkdirSync(samplesDir, { recursive: true });
const samples = readdirSync(samplesSource).filter((name) => name.endsWith('.ifc'));
for (const name of samples) copyFileSync(join(samplesSource, name), join(samplesDir, name));

console.log(`web-ifc.wasm and ${samples.length} sample models copied to public/`);
