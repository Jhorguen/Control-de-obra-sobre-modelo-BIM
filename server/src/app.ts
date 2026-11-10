import express, { type Express } from 'express';
import { isDatabaseUp } from './db.js';
import type { PrismaClient } from './generated/prisma/client.js';
import { cors } from './middleware/cors.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { createBudgetItemsRouter, createProjectBudgetRouter } from './routes/budget.js';
import { createElementsRouter } from './routes/elements.js';
import { createHealthRouter } from './routes/health.js';
import { createElementProgressRouter, createProjectProgressRouter } from './routes/progress.js';
import { createProjectsRouter } from './routes/projects.js';

/**
 * External dependencies are injected instead of imported, so the HTTP layer can be
 * tested with Supertest against a test database (or none at all for /health).
 */
export interface AppDependencies {
  prisma: PrismaClient;
  /** Origins allowed to call the API from a browser (the deployed frontend). */
  corsOrigins?: readonly string[];
  /** Overrides the database check; used by tests that run without a database. */
  checkDatabase?: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): Express {
  const { prisma, corsOrigins = [] } = deps;
  const checkDatabase = deps.checkDatabase ?? (() => isDatabaseUp(prisma));

  const app = express();
  app.disable('x-powered-by');
  app.use(cors(corsOrigins));
  // The element list of a whole model can weigh a few MB. Only this route gets a larger
  // body limit; it is registered first, so the global parser below skips the parsed body.
  app.post('/api/projects/:id/elements/bulk', express.json({ limit: '10mb' }));
  app.use(express.json());

  app.use('/api/health', createHealthRouter(checkDatabase));
  app.use('/api/projects', createProjectsRouter(prisma));
  app.use('/api/projects/:id', createElementsRouter(prisma));
  app.use('/api/projects/:id', createProjectBudgetRouter(prisma));
  app.use('/api/projects/:id', createProjectProgressRouter(prisma));
  app.use('/api/budget-items', createBudgetItemsRouter(prisma));
  app.use('/api/elements', createElementProgressRouter(prisma));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
