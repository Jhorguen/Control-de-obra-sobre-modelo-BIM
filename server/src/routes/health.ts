import type { HealthResponse } from '@bim/shared';
import { Router } from 'express';

export function createHealthRouter(checkDatabase: () => Promise<boolean>): Router {
  const router = Router();

  router.get('/', async (_req, res) => {
    const databaseUp = await checkDatabase();
    const body: HealthResponse = {
      status: databaseUp ? 'ok' : 'degraded',
      database: databaseUp ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
    // 503 tells monitors the service cannot do its job; the body still explains why.
    res.status(databaseUp ? 200 : 503).json(body);
  });

  return router;
}
