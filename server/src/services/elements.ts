import type {
  BulkElementsResult,
  Element,
  ElementInput,
  ElementsPage,
  ElementsQuery,
  QuantitiesResponse,
} from '@bim/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { assertNotDemo, getProject } from './projects.js';
import { groupQuantities } from './quantities.js';

const CHUNK_SIZE = 1000;

function chunks<T>(items: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/**
 * Saves the complete element list of a (re)imported model in one transaction:
 * - new GlobalIds are inserted, known ones updated (upsert), so importing the same IFC twice
 *   never duplicates elements and keeps their budget items and progress history;
 * - elements no longer present are marked with removed_at instead of being deleted.
 */
export async function replaceProjectElements(
  prisma: PrismaClient,
  projectId: number,
  elements: readonly ElementInput[],
): Promise<BulkElementsResult> {
  const project = await getProject(prisma, projectId);
  assertNotDemo(project);

  // Some exporters write duplicated GlobalIds; keep the first occurrence.
  const unique = new Map<string, ElementInput>();
  for (const element of elements) {
    if (!unique.has(element.globalId)) unique.set(element.globalId, element);
  }
  const rows = [...unique.values()];

  return prisma.$transaction(
    async (tx) => {
      let created = 0;
      let updated = 0;

      for (const chunk of chunks(rows, CHUNK_SIZE)) {
        // One INSERT ... ON CONFLICT per chunk instead of one query per element.
        // `xmax = 0` is true only for rows inserted by this statement (PostgreSQL detail),
        // which tells created and updated rows apart.
        const result = await tx.$queryRaw<{ inserted: boolean }[]>`
          INSERT INTO elements
            (project_id, global_id, ifc_class, name, type_name, level, volume, area, length, updated_at)
          SELECT ${projectId}, u.global_id, u.ifc_class, u.name, u.type_name, u.level,
                 u.volume, u.area, u.length, now()
          FROM unnest(
            ${chunk.map((e) => e.globalId)}::text[],
            ${chunk.map((e) => e.ifcClass)}::text[],
            ${chunk.map((e) => e.name)}::text[],
            ${chunk.map((e) => e.typeName)}::text[],
            ${chunk.map((e) => e.level)}::text[],
            ${chunk.map((e) => e.volume)}::float8[],
            ${chunk.map((e) => e.area)}::float8[],
            ${chunk.map((e) => e.length)}::float8[]
          ) AS u(global_id, ifc_class, name, type_name, level, volume, area, length)
          ON CONFLICT (project_id, global_id) DO UPDATE SET
            ifc_class = EXCLUDED.ifc_class,
            name = EXCLUDED.name,
            type_name = EXCLUDED.type_name,
            level = EXCLUDED.level,
            volume = EXCLUDED.volume,
            area = EXCLUDED.area,
            length = EXCLUDED.length,
            removed_at = NULL,
            updated_at = now()
          RETURNING (xmax = 0) AS inserted`;
        for (const row of result) {
          if (row.inserted) created++;
          else updated++;
        }
      }

      const removed = await tx.$executeRaw`
        UPDATE elements SET removed_at = now(), updated_at = now()
        WHERE project_id = ${projectId}
          AND removed_at IS NULL
          AND NOT (global_id = ANY(${rows.map((e) => e.globalId)}::text[]))`;

      return {
        received: elements.length,
        created,
        updated,
        removed,
        duplicatesIgnored: elements.length - rows.length,
      };
    },
    // Large models can take a few seconds; Prisma's default transaction timeout is 5 s.
    { timeout: 60_000 },
  );
}

const elementSelect = {
  id: true,
  globalId: true,
  ifcClass: true,
  name: true,
  typeName: true,
  level: true,
  volume: true,
  area: true,
  length: true,
} as const;

export async function listElements(
  prisma: PrismaClient,
  projectId: number,
  query: ElementsQuery,
): Promise<ElementsPage> {
  await getProject(prisma, projectId);
  const where = {
    projectId,
    removedAt: null,
    ...(query.ifcClass ? { ifcClass: query.ifcClass } : {}),
    ...(query.level ? { level: query.level } : {}),
  };
  const [total, items] = await prisma.$transaction([
    prisma.element.count({ where }),
    prisma.element.findMany({
      where,
      select: elementSelect,
      orderBy: [{ ifcClass: 'asc' }, { name: 'asc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);
  return { items: items satisfies Element[], total, page: query.page, pageSize: query.pageSize };
}

export async function getQuantities(
  prisma: PrismaClient,
  projectId: number,
): Promise<QuantitiesResponse> {
  await getProject(prisma, projectId);
  const elements = await prisma.element.findMany({
    where: { projectId, removedAt: null },
    select: {
      globalId: true,
      ifcClass: true,
      typeName: true,
      level: true,
      volume: true,
      area: true,
      length: true,
    },
  });
  return groupQuantities(elements);
}
