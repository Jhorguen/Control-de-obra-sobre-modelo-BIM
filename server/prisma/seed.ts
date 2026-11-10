/**
 * Demo project seed: leaves (or restores) "Casa FZK (demo)" ready to explore, with the
 * sample IFC, its Fragments model, extracted quantities, budget items and some progress.
 *
 *   npm run db:seed -w @bim/server                # create or reset the demo
 *   npm run db:seed -w @bim/server -- --if-missing  # only create it when it does not exist
 *
 * It goes through the same services as the API, so the data is exactly what a user would
 * produce. Dates are relative to today, so the demo always looks like a site in progress.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, sep } from 'node:path';
import type { BudgetItemInput, ProgressStatus } from '@bim/shared';
import { extractElementsFromBytes, type ExtractedElement } from '@bim/shared/extraction';
import { IfcImporter } from '@thatopen/fragments';
import { IfcAPI } from 'web-ifc';
import { createPrismaClient } from '../src/db.js';
import { env } from '../src/env.js';
import { assignBudgetItem, createBudgetItem } from '../src/services/budget.js';
import { replaceProjectElements } from '../src/services/elements.js';
import { recordProgress, setPlannedDate } from '../src/services/progress.js';
import { saveModelFile } from '../src/services/projects.js';

const IFC_PATH = new URL('../../samples/AC20-FZK-Haus.ifc', import.meta.url);
const DEMO_NAME = 'Casa FZK (demo)';
const DEMO_DESCRIPTION =
  'Casa de dos plantas (modelo de ejemplo del KIT). Presupuesto y avance de demostración.';

const prisma = createPrismaClient(env.DATABASE_URL);

/** YYYY-MM-DD for today + `days` (negative = past). */
function day(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Converts the IFC to Fragments in Node with the same library the browser viewer uses. */
async function convertToFragments(ifc: Uint8Array): Promise<Uint8Array> {
  const require = createRequire(import.meta.url);
  const wasmDir = dirname(require.resolve('web-ifc/web-ifc-node.wasm')).split(sep).join('/');
  const importer = new IfcImporter();
  importer.wasm = { path: `${wasmDir}/`, absolute: true };
  return importer.process({ bytes: ifc });
}

async function extract(ifc: Uint8Array): Promise<ExtractedElement[]> {
  const api = new IfcAPI();
  await api.Init();
  return extractElementsFromBytes(api, ifc).elements;
}

/** Reuses the demo project's id (open links keep working) and empties it. */
async function prepareProject(): Promise<number | null> {
  const existing = await prisma.project.findFirst({ where: { isDemo: true } });
  if (existing && process.argv.includes('--if-missing')) return null;
  if (!existing) {
    const created = await prisma.project.create({
      data: { name: DEMO_NAME, description: DEMO_DESCRIPTION },
    });
    return created.id;
  }
  // Unlocked while seeding: the services refuse to modify a demo project.
  await prisma.$transaction([
    prisma.modelFile.deleteMany({ where: { projectId: existing.id } }),
    prisma.element.deleteMany({ where: { projectId: existing.id } }),
    prisma.budgetItem.deleteMany({ where: { projectId: existing.id } }),
    prisma.project.update({
      where: { id: existing.id },
      data: { name: DEMO_NAME, description: DEMO_DESCRIPTION, isDemo: false },
    }),
  ]);
  return existing.id;
}

type Selector = (e: ExtractedElement) => boolean;

const isWall: Selector = (e) => e.ifcClass.startsWith('IfcWall');
const groundFloor = 'Erdgeschoss';
const upperFloor = 'Dachgeschoss';
const named =
  (...names: string[]): Selector =>
  (e) =>
    e.name !== null && names.includes(e.name);

/** Budget items with Colombian reference unit prices (COP, from typical APUs). */
const ITEMS: (BudgetItemInput & { selector: Selector })[] = [
  {
    code: '1.1',
    description: 'Losa de cimentación en concreto 3000 psi, e = 20 cm',
    unit: 'M3',
    quantitySource: 'VOLUME',
    factor: 1,
    unitPrice: 560_000,
    selector: named('Bodenplatte'),
  },
  {
    code: '2.1',
    description: 'Muros en concreto 3000 psi',
    unit: 'M3',
    quantitySource: 'VOLUME',
    factor: 1,
    unitPrice: 520_000,
    selector: isWall,
  },
  {
    code: '2.2',
    description: 'Acero de refuerzo fy = 420 MPa para muros (cuantía 80 kg/m³)',
    unit: 'KG',
    quantitySource: 'VOLUME',
    factor: 80,
    unitPrice: 6_200,
    selector: isWall,
  },
  {
    code: '2.3',
    description: 'Formaleta para muros a dos caras',
    unit: 'M2',
    quantitySource: 'AREA',
    factor: 2,
    unitPrice: 38_000,
    selector: isWall,
  },
  {
    code: '3.1',
    description: 'Losa de entrepiso en concreto 3000 psi',
    unit: 'M3',
    quantitySource: 'VOLUME',
    factor: 1,
    unitPrice: 610_000,
    selector: named('Slab-033'),
  },
  {
    code: '3.2',
    description: 'Vigas en concreto 3000 psi',
    unit: 'M3',
    quantitySource: 'VOLUME',
    factor: 1,
    unitPrice: 640_000,
    selector: (e) => e.ifcClass === 'IfcBeam',
  },
  {
    code: '4.1',
    description: 'Cubierta: placa inclinada e impermeabilización',
    unit: 'M2',
    quantitySource: 'AREA',
    factor: 1,
    unitPrice: 185_000,
    selector: named('Dach-1', 'Dach-2'),
  },
  {
    code: '5.1',
    description: 'Ventana en aluminio con vidrio templado',
    unit: 'UN',
    quantitySource: 'COUNT',
    factor: 1,
    unitPrice: 1_150_000,
    selector: (e) => e.ifcClass === 'IfcWindow',
  },
  {
    code: '5.2',
    description: 'Puerta en madera con marco',
    unit: 'UN',
    quantitySource: 'COUNT',
    factor: 1,
    unitPrice: 980_000,
    selector: (e) => e.ifcClass === 'IfcDoor',
  },
];

/** Planned dates: a site started about three months ago, with openings still ahead. */
const SCHEDULE: [Selector, number][] = [
  [named('Bodenplatte'), -100],
  [(e) => isWall(e) && e.level === groundFloor, -75],
  [named('Unterzug-1'), -62],
  [named('Slab-033'), -55],
  [(e) => isWall(e) && e.level === upperFloor, -35],
  [(e) => e.ifcClass === 'IfcBeam' && e.level === upperFloor, -20],
  [named('Dach-1', 'Dach-2'), -15],
  [(e) => e.ifcClass === 'IfcWindow', 12],
  [(e) => e.ifcClass === 'IfcDoor', 20],
];

/** Site log, oldest first. */
const LOG: [Selector, ProgressStatus, number, string?][] = [
  [named('Bodenplatte'), 'DONE', -96, 'Fundida losa de cimentación'],
  [(e) => isWall(e) && e.level === groundFloor, 'IN_PROGRESS', -85, 'Inicio de muros planta baja'],
  [(e) => isWall(e) && e.level === groundFloor, 'DONE', -70],
  [named('Unterzug-1'), 'DONE', -60],
  [named('Slab-033'), 'IN_PROGRESS', -58, 'Armado y formaleta de entrepiso'],
  [named('Slab-033'), 'DONE', -50, 'Fundido entrepiso'],
  [(e) => isWall(e) && e.level === upperFloor, 'IN_PROGRESS', -30],
  [named('Wand-Ext-OG-1', 'Wand-Ext-OG-3'), 'DONE', -14, 'Muros de fachada planta alta'],
  [named('Dach-1', 'Dach-2'), 'IN_PROGRESS', -5, 'Montaje de cubierta'],
];

async function main(): Promise<void> {
  const projectId = await prepareProject();
  if (projectId === null) {
    console.log('Demo project already exists (--if-missing): nothing to do.');
    return;
  }

  const ifc = new Uint8Array(readFileSync(IFC_PATH));
  console.log('Converting the IFC to Fragments and extracting quantities…');
  const [fragments, elements] = await Promise.all([convertToFragments(ifc), extract(ifc)]);

  await saveModelFile(prisma, projectId, 'ifc', 'AC20-FZK-Haus.ifc', ifc);
  await saveModelFile(prisma, projectId, 'frag', 'AC20-FZK-Haus.frag', fragments);
  const imported = await replaceProjectElements(prisma, projectId, elements);

  const guidsOf = (selector: Selector) => elements.filter(selector).map((e) => e.globalId);

  for (const { selector, ...input } of ITEMS) {
    const item = await createBudgetItem(prisma, projectId, input);
    await assignBudgetItem(prisma, projectId, guidsOf(selector), item.id);
  }
  for (const [selector, days] of SCHEDULE) {
    await setPlannedDate(prisma, projectId, guidsOf(selector), day(days));
  }
  for (const [selector, status, days, note] of LOG) {
    await recordProgress(prisma, projectId, guidsOf(selector), status, day(days), note);
  }

  await prisma.project.update({ where: { id: projectId }, data: { isDemo: true } });
  console.log(
    `Demo project #${projectId} ready: ${imported.created} elements, ${ITEMS.length} budget items, ${LOG.length} progress entries.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
