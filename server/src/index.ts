// env must be imported first: it loads .env and validates the variables.
import { env } from './env.js';
import { createApp } from './app.js';
import { createPrismaClient } from './db.js';

const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({ prisma, corsOrigins: env.CORS_ORIGINS });

const server = app.listen(env.PORT, () => {
  console.log(`API listening on http://localhost:${env.PORT}`);
});

// Hosting platforms send SIGTERM before stopping the process: finish in-flight
// requests and close the database pool cleanly.
function shutdown(signal: string): void {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
