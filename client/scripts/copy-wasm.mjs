// Copies the web-ifc WebAssembly binary to public/wasm so it is served at a stable URL
// (/wasm/web-ifc.wasm). The IFC importer needs a folder path, not a bundler-hashed file,
// and copying from node_modules guarantees the .wasm matches the installed JS version.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const source = require.resolve('web-ifc/web-ifc.wasm');
const targetDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'wasm');

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, join(targetDir, 'web-ifc.wasm'));
console.log('web-ifc.wasm copied to public/wasm');
