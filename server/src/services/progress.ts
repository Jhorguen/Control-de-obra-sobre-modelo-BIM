import type {
  AssignmentResult,
  ProgressRecord,
  ProgressStatus,
  ProgressSummary,
  StatusMapEntry,
} from '@bim/shared';
import type { PrismaClient } from '../generated/prisma/client.js';
import { notFound } from '../http.js';
import { HttpError } from '../middleware/errors.js';
import { computeProgressSummary, type ProgressElement } from './progressCalculation.js';
import { getProject } from './projects.js';

// DATE columns come back as UTC midnight; the API speaks YYYY-MM-DD.
const toDate = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const toIsoDate = (date: Date) => date.toISOString().slice(0, 10);

/** A progress record dated in the future makes no sense (one day of margin for time zones). */
function assertNotFuture(iso: string): void {
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  if (iso > toIsoDate(tomorrow)) {
    throw new HttpError(400, 'FUTURE_DATE', 'La fecha del avance no puede ser futura.');
  }
}

async function activeElementIds(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
): Promise<number[]> {
  await getProject(prisma, projectId);
  const elements = await prisma.element.findMany({
    where: { projectId, removedAt: null, globalId: { in: [...globalIds] } },
    select: { id: true },
  });
  return elements.map((e) => e.id);
}

/** Appends a record per element: the log is never rewritten, so the history stays complete. */
export async function recordProgress(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
  status: ProgressStatus,
  date: string,
  note: string | undefined,
): Promise<AssignmentResult> {
  assertNotFuture(date);
  const ids = await activeElementIds(prisma, projectId, globalIds);
  const result = await prisma.progressRecord.createMany({
    data: ids.map((elementId) => ({ elementId, status, date: toDate(date), note: note || null })),
  });
  return { affected: result.count };
}

export async function setPlannedDate(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
  plannedDate: string | null,
): Promise<AssignmentResult> {
  const ids = await activeElementIds(prisma, projectId, globalIds);
  const result = await prisma.element.updateMany({
    where: { id: { in: ids } },
    data: { plannedDate: plannedDate === null ? null : toDate(plannedDate) },
  });
  return { affected: result.count };
}

const latestRecord = {
  select: { status: true },
  orderBy: [{ date: 'desc' as const }, { createdAt: 'desc' as const }],
  take: 1,
};

export async function getStatusMap(
  prisma: PrismaClient,
  projectId: number,
): Promise<StatusMapEntry[]> {
  await getProject(prisma, projectId);
  const rows = await prisma.element.findMany({
    where: { projectId, removedAt: null },
    select: {
      id: true,
      globalId: true,
      plannedDate: true,
      progressRecords: latestRecord,
      _count: { select: { budgetItems: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    globalId: row.globalId,
    status: row.progressRecords[0]?.status ?? 'PENDING',
    plannedDate: row.plannedDate ? toIsoDate(row.plannedDate) : null,
    hasBudgetItem: row._count.budgetItems > 0,
  }));
}

export async function getElementHistory(
  prisma: PrismaClient,
  elementId: number,
): Promise<ProgressRecord[]> {
  const element = await prisma.element.findUnique({
    where: { id: elementId },
    select: { id: true },
  });
  if (!element) throw notFound('El elemento');
  const records = await prisma.progressRecord.findMany({
    where: { elementId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  return records.map((r) => ({
    id: r.id,
    status: r.status,
    date: toIsoDate(r.date),
    note: r.note,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getProgressSummary(
  prisma: PrismaClient,
  projectId: number,
): Promise<ProgressSummary> {
  await getProject(prisma, projectId);
  const [items, rows] = await Promise.all([
    prisma.budgetItem.findMany({
      where: { projectId },
      select: { id: true, code: true, quantitySource: true, factor: true, unitPrice: true },
    }),
    prisma.element.findMany({
      where: { projectId, removedAt: null },
      select: {
        id: true,
        globalId: true,
        ifcClass: true,
        level: true,
        volume: true,
        area: true,
        length: true,
        plannedDate: true,
        budgetItems: { select: { budgetItemId: true } },
        progressRecords: { select: { status: true, date: true, createdAt: true } },
      },
    }),
  ]);

  const elements: ProgressElement[] = rows.map((row) => ({
    id: row.id,
    globalId: row.globalId,
    ifcClass: row.ifcClass,
    level: row.level,
    volume: row.volume,
    area: row.area,
    length: row.length,
    plannedDate: row.plannedDate ? toIsoDate(row.plannedDate) : null,
    budgetItemIds: row.budgetItems.map((b) => b.budgetItemId),
    history: row.progressRecords.map((r) => ({
      status: r.status,
      date: toIsoDate(r.date),
      createdAt: r.createdAt,
    })),
  }));
  return computeProgressSummary(items, elements);
}
