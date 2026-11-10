import { assignmentRequestSchema, budgetItemInputSchema } from '@bim/shared';
import { Router, type Request } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseId } from '../http.js';
import {
  assignBudgetItem,
  createBudgetItem,
  deleteBudgetItem,
  getBudget,
  listBudgetItems,
  unassignBudgetItem,
  updateBudgetItem,
} from '../services/budget.js';

const projectIdOf = (req: Request) => parseId((req.params as Record<string, string>)['id']);

/** Routes nested under /api/projects/:id. */
export function createProjectBudgetRouter(prisma: PrismaClient): Router {
  const router = Router({ mergeParams: true });

  router.get('/budget-items', async (req, res) => {
    res.json(await listBudgetItems(prisma, projectIdOf(req)));
  });

  router.post('/budget-items', async (req, res) => {
    const input = budgetItemInputSchema.parse(req.body);
    res.status(201).json(await createBudgetItem(prisma, projectIdOf(req), input));
  });

  router.put('/elements/assign', async (req, res) => {
    const { globalIds, budgetItemId } = assignmentRequestSchema.parse(req.body);
    res.json(await assignBudgetItem(prisma, projectIdOf(req), globalIds, budgetItemId));
  });

  router.put('/elements/unassign', async (req, res) => {
    const { globalIds, budgetItemId } = assignmentRequestSchema.parse(req.body);
    res.json(await unassignBudgetItem(prisma, projectIdOf(req), globalIds, budgetItemId));
  });

  router.get('/budget', async (req, res) => {
    res.json(await getBudget(prisma, projectIdOf(req)));
  });

  return router;
}

/** /api/budget-items/:id */
export function createBudgetItemsRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.put('/:id', async (req, res) => {
    const input = budgetItemInputSchema.parse(req.body);
    res.json(await updateBudgetItem(prisma, parseId(req.params.id), input));
  });

  router.delete('/:id', async (req, res) => {
    await deleteBudgetItem(prisma, parseId(req.params.id));
    res.status(204).end();
  });

  return router;
}
