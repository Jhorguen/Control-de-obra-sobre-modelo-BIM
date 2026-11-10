import { bulkElementsRequestSchema, elementsQuerySchema } from '@bim/shared';
import { Router, type Request } from 'express';
import type { PrismaClient } from '../generated/prisma/client.js';
import { parseId } from '../http.js';
import { getQuantities, listElements, replaceProjectElements } from '../services/elements.js';

/** :id comes from the parent path (/api/projects/:id); Express cannot type it here. */
const projectIdOf = (req: Request) => parseId((req.params as Record<string, string>)['id']);

/** Routes nested under /api/projects/:id (mergeParams exposes :id here). */
export function createElementsRouter(prisma: PrismaClient): Router {
  const router = Router({ mergeParams: true });

  router.post('/elements/bulk', async (req, res) => {
    const { elements } = bulkElementsRequestSchema.parse(req.body);
    res.json(await replaceProjectElements(prisma, projectIdOf(req), elements));
  });

  router.get('/elements', async (req, res) => {
    res.json(await listElements(prisma, projectIdOf(req), elementsQuerySchema.parse(req.query)));
  });

  router.get('/quantities', async (req, res) => {
    res.json(await getQuantities(prisma, projectIdOf(req)));
  });

  return router;
}
