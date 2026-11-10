import express, { type Express } from 'express';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { createHealthRouter } from './routes/health.js';

/**
 * External dependencies are injected instead of imported, so the HTTP layer can be
 * tested with Supertest without a real database.
 */
export interface AppDependencies {
  checkDatabase: () => Promise<boolean>;
}

export function createApp(deps: AppDependencies): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api/health', createHealthRouter(deps.checkDatabase));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
