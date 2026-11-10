import { plannedDateRequestSchema, progressRequestSchema } from '@bim/shared';
import { Router, type Request } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseId } from '../http.js';
import {
  getElementHistory,
  getProgressSummary,
  getStatusMap,
  recordProgress,
  setPlannedDate,
} from '../services/progress.js';

const projectIdOf = (req: Request) => parseId((req.params as Record<string, string>)['id']);

/** Routes nested under /api/projects/:id. */
export function createProjectProgressRouter(prisma: PrismaClient): Router {
  const router = Router({ mergeParams: true });

  router.post('/progress', async (req, res) => {
    const { globalIds, status, date, note } = progressRequestSchema.parse(req.body);
    res
      .status(201)
      .json(await recordProgress(prisma, projectIdOf(req), globalIds, status, date, note));
  });

  router.put('/elements/planned-date', async (req, res) => {
    const { globalIds, plannedDate } = plannedDateRequestSchema.parse(req.body);
    res.json(await setPlannedDate(prisma, projectIdOf(req), globalIds, plannedDate));
  });

  router.get('/status-map', async (req, res) => {
    res.json(await getStatusMap(prisma, projectIdOf(req)));
  });

  router.get('/summary', async (req, res) => {
    res.json(await getProgressSummary(prisma, projectIdOf(req)));
  });

  return router;
}

/** /api/elements/:id */
export function createElementProgressRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get('/:id/progress', async (req, res) => {
    res.json(await getElementHistory(prisma, parseId(req.params.id)));
  });

  return router;
}
