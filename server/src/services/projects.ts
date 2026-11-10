import type { CreateProjectInput, ModelFileKind, Project } from '@bim/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { ModelFileKind as DbModelFileKind } from '../generated/prisma/enums.js';
import { notFound } from '../http.js';
import { HttpError } from '../middleware/errors.js';

const KIND_TO_DB: Record<ModelFileKind, DbModelFileKind> = {
  ifc: DbModelFileKind.IFC,
  frag: DbModelFileKind.FRAG,
};

// Only metadata: the binary `data` column is never loaded when listing projects.
const projectSelect = {
  id: true,
  name: true,
  description: true,
  isDemo: true,
  createdAt: true,
  files: { select: { kind: true, fileName: true, sizeBytes: true, createdAt: true } },
} as const;

type ProjectRow = {
  id: number;
  name: string;
  description: string | null;
  isDemo: boolean;
  createdAt: Date;
  files: { kind: DbModelFileKind; fileName: string; sizeBytes: number; createdAt: Date }[];
};

function toProjectDto(row: ProjectRow): Project {
  const fileInfo = (kind: DbModelFileKind) => {
    const file = row.files.find((f) => f.kind === kind);
    return file
      ? {
          fileName: file.fileName,
          sizeBytes: file.sizeBytes,
          uploadedAt: file.createdAt.toISOString(),
        }
      : null;
  };
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isDemo: row.isDemo,
    createdAt: row.createdAt.toISOString(),
    files: { ifc: fileInfo(DbModelFileKind.IFC), frag: fileInfo(DbModelFileKind.FRAG) },
  };
}

export async function listProjects(prisma: PrismaClient): Promise<Project[]> {
  const rows = await prisma.project.findMany({
    select: projectSelect,
    orderBy: [{ isDemo: 'desc' }, { createdAt: 'desc' }],
  });
  return rows.map(toProjectDto);
}

export async function getProject(prisma: PrismaClient, id: number): Promise<Project> {
  const row = await prisma.project.findUnique({ where: { id }, select: projectSelect });
  if (!row) throw notFound('El proyecto');
  return toProjectDto(row);
}

export async function createProject(
  prisma: PrismaClient,
  input: CreateProjectInput,
): Promise<Project> {
  const row = await prisma.project.create({
    data: { name: input.name, description: input.description || null },
    select: projectSelect,
  });
  return toProjectDto(row);
}

/** The public demo must stay usable for every visitor, so destructive actions are blocked. */
function assertNotDemo(project: { isDemo: boolean }): void {
  if (project.isDemo) {
    throw new HttpError(
      403,
      'DEMO_PROJECT_LOCKED',
      'El proyecto de demostración no se puede eliminar ni cambiar su modelo.',
    );
  }
}

export async function deleteProject(prisma: PrismaClient, id: number): Promise<void> {
  const project = await getProject(prisma, id);
  assertNotDemo(project);
  // Elements, budget items, files and progress records go away through ON DELETE CASCADE.
  await prisma.project.delete({ where: { id } });
}

/** IFC files are STEP physical files: they always start with this header. */
const IFC_SIGNATURE = 'ISO-10303-21';

function looksLikeIfc(data: Uint8Array): boolean {
  const head = Buffer.from(data.subarray(0, 64)).toString('utf8');
  // Strip a UTF-8 byte order mark if the exporter wrote one.
  const text = head.charCodeAt(0) === 0xfeff ? head.slice(1) : head;
  return text.trimStart().startsWith(IFC_SIGNATURE);
}

export async function saveModelFile(
  prisma: PrismaClient,
  projectId: number,
  kind: ModelFileKind,
  fileName: string,
  data: Uint8Array,
): Promise<Project> {
  const project = await getProject(prisma, projectId);
  assertNotDemo(project);

  if (data.byteLength === 0) {
    throw new HttpError(400, 'EMPTY_FILE', 'El archivo está vacío.');
  }
  if (kind === 'ifc' && !looksLikeIfc(data)) {
    throw new HttpError(400, 'INVALID_IFC', 'El archivo no parece un IFC válido.');
  }

  // Prisma's Bytes type needs a Uint8Array backed by a plain ArrayBuffer (a Node Buffer
  // may come from a shared pool), so copy the bytes once.
  const bytes = new Uint8Array(data);
  const dbKind = KIND_TO_DB[kind];
  await prisma.modelFile.upsert({
    where: { projectId_kind: { projectId, kind: dbKind } },
    create: { projectId, kind: dbKind, fileName, sizeBytes: bytes.byteLength, data: bytes },
    update: { fileName, sizeBytes: bytes.byteLength, data: bytes, createdAt: new Date() },
  });
  return getProject(prisma, projectId);
}

export interface ModelFileVersion {
  id: number;
  fileName: string;
  sizeBytes: number;
  createdAt: Date;
}

/** Metadata only, so the route can answer 304 Not Modified without reading the bytes. */
export async function getModelFileVersion(
  prisma: PrismaClient,
  projectId: number,
  kind: ModelFileKind,
): Promise<ModelFileVersion> {
  const file = await prisma.modelFile.findUnique({
    where: { projectId_kind: { projectId, kind: KIND_TO_DB[kind] } },
    select: { id: true, fileName: true, sizeBytes: true, createdAt: true },
  });
  if (!file) throw notFound('El archivo del modelo');
  return file;
}

export async function getModelFileData(prisma: PrismaClient, fileId: number): Promise<Uint8Array> {
  const file = await prisma.modelFile.findUnique({ where: { id: fileId }, select: { data: true } });
  if (!file) throw notFound('El archivo del modelo');
  return file.data;
}
