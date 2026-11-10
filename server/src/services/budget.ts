import type { AssignmentResult, BudgetItem, BudgetItemInput, BudgetResponse } from '@bim/shared';
import { budgetItemInputSchema } from '@bim/shared';
import { Prisma, type PrismaClient } from '../generated/prisma/client.js';
import { notFound } from '../http.js';
import { HttpError } from '../middleware/errors.js';
import {
  computeItemTotals,
  elementsWithoutQuantity,
  sumDecimals,
  summarizeGroup,
  unassignedElements,
  type CalcElement,
  type CalcItem,
} from './budgetCalculation.js';
import { getProject } from './projects.js';

type BudgetItemRow = {
  id: number;
  code: string;
  description: string;
  unit: BudgetItem['unit'];
  quantitySource: BudgetItem['quantitySource'];
  factor: Prisma.Decimal;
  unitPrice: Prisma.Decimal;
};

const itemSelect = {
  id: true,
  code: true,
  description: true,
  unit: true,
  quantitySource: true,
  factor: true,
  unitPrice: true,
} as const;

/** Decimals travel as JSON numbers: COP amounts stay far below 2^53 cents. */
function toItemDto(row: BudgetItemRow): BudgetItem {
  return { ...row, factor: row.factor.toNumber(), unitPrice: row.unitPrice.toNumber() };
}

/** Natural order for budget codes: 1.2 before 1.10. */
const byCode = (a: { code: string }, b: { code: string }) =>
  a.code.localeCompare(b.code, 'es', { numeric: true });

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function duplicateCode(code: string): HttpError {
  return new HttpError(409, 'DUPLICATE_CODE', `Ya existe un ítem con el código "${code}".`);
}

function toData(input: BudgetItemInput) {
  const parsed = budgetItemInputSchema.parse(input);
  return {
    ...parsed,
    factor: new Prisma.Decimal(parsed.factor),
    // Prices are stored with two decimals.
    unitPrice: new Prisma.Decimal(parsed.unitPrice).toDecimalPlaces(2),
  };
}

export async function listBudgetItems(
  prisma: PrismaClient,
  projectId: number,
): Promise<BudgetItem[]> {
  await getProject(prisma, projectId);
  const rows = await prisma.budgetItem.findMany({ where: { projectId }, select: itemSelect });
  return rows.sort(byCode).map(toItemDto);
}

export async function createBudgetItem(
  prisma: PrismaClient,
  projectId: number,
  input: BudgetItemInput,
): Promise<BudgetItem> {
  await getProject(prisma, projectId);
  const data = toData(input);
  try {
    const row = await prisma.budgetItem.create({
      data: { ...data, projectId },
      select: itemSelect,
    });
    return toItemDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(data.code);
    throw error;
  }
}

async function findItem(prisma: PrismaClient, id: number) {
  const item = await prisma.budgetItem.findUnique({
    where: { id },
    select: { id: true, projectId: true },
  });
  if (!item) throw notFound('El ítem de presupuesto');
  return item;
}

export async function updateBudgetItem(
  prisma: PrismaClient,
  id: number,
  input: BudgetItemInput,
): Promise<BudgetItem> {
  await findItem(prisma, id);
  const data = toData(input);
  try {
    const row = await prisma.budgetItem.update({ where: { id }, data, select: itemSelect });
    return toItemDto(row);
  } catch (error) {
    if (isUniqueViolation(error)) throw duplicateCode(data.code);
    throw error;
  }
}

/** Assignments go away with the item (ON DELETE CASCADE); elements are untouched. */
export async function deleteBudgetItem(prisma: PrismaClient, id: number): Promise<void> {
  await findItem(prisma, id);
  await prisma.budgetItem.delete({ where: { id } });
}

/** Resolves GlobalIds to active element ids of the project and checks the item belongs to it. */
async function resolveAssignment(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
  budgetItemId: number,
): Promise<number[]> {
  await getProject(prisma, projectId);
  const item = await findItem(prisma, budgetItemId);
  if (item.projectId !== projectId) {
    throw new HttpError(400, 'ITEM_FROM_OTHER_PROJECT', 'El ítem pertenece a otro proyecto.');
  }
  const elements = await prisma.element.findMany({
    where: { projectId, removedAt: null, globalId: { in: [...globalIds] } },
    select: { id: true },
  });
  return elements.map((e) => e.id);
}

export async function assignBudgetItem(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
  budgetItemId: number,
): Promise<AssignmentResult> {
  const elementIds = await resolveAssignment(prisma, projectId, globalIds, budgetItemId);
  // skipDuplicates: assigning twice is harmless (the pair is the primary key).
  const result = await prisma.elementBudgetItem.createMany({
    data: elementIds.map((elementId) => ({ elementId, budgetItemId })),
    skipDuplicates: true,
  });
  return { affected: result.count };
}

export async function unassignBudgetItem(
  prisma: PrismaClient,
  projectId: number,
  globalIds: readonly string[],
  budgetItemId: number,
): Promise<AssignmentResult> {
  const elementIds = await resolveAssignment(prisma, projectId, globalIds, budgetItemId);
  const result = await prisma.elementBudgetItem.deleteMany({
    where: { budgetItemId, elementId: { in: elementIds } },
  });
  return { affected: result.count };
}

/** Loads what the calculations need: items, active elements, assignments and status. */
export async function loadCalculationData(
  prisma: PrismaClient,
  projectId: number,
): Promise<{ items: (CalcItem & BudgetItemRow)[]; elements: CalcElement[] }> {
  const [items, rows] = await Promise.all([
    prisma.budgetItem.findMany({ where: { projectId }, select: itemSelect }),
    prisma.element.findMany({
      where: { projectId, removedAt: null },
      select: {
        id: true,
        globalId: true,
        ifcClass: true,
        volume: true,
        area: true,
        length: true,
        budgetItems: { select: { budgetItemId: true } },
        // Latest record = current status (date first, creation time breaks ties).
        progressRecords: {
          select: { status: true },
          orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
          take: 1,
        },
      },
    }),
  ]);
  const elements = rows.map((row) => ({
    id: row.id,
    globalId: row.globalId,
    ifcClass: row.ifcClass,
    volume: row.volume,
    area: row.area,
    length: row.length,
    budgetItemIds: row.budgetItems.map((b) => b.budgetItemId),
    executed: row.progressRecords[0]?.status === 'DONE',
  }));
  return { items: items.sort(byCode), elements };
}

export async function getBudget(prisma: PrismaClient, projectId: number): Promise<BudgetResponse> {
  await getProject(prisma, projectId);
  const { items, elements } = await loadCalculationData(prisma, projectId);
  const totals = computeItemTotals(items, elements);

  return {
    lines: items.map((item, index) => {
      const t = totals[index]!;
      return {
        item: toItemDto(item),
        elementCount: t.elementCount,
        withoutQuantity: t.withoutQuantity,
        quantity: t.quantity.toNumber(),
        subtotal: t.subtotal.toNumber(),
        globalIds: t.globalIds,
      };
    }),
    total: sumDecimals(totals.map((t) => t.subtotal)).toNumber(),
    unassigned: summarizeGroup(unassignedElements(elements)),
    withoutQuantity: summarizeGroup(elementsWithoutQuantity(items, elements)),
  };
}
