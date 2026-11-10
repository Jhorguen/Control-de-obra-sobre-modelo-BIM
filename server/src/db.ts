import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.js';

/**
 * Prisma 7 talks to PostgreSQL through a driver adapter (node-postgres here).
 * Create a single instance per process: each client owns a connection pool.
 */
export function createPrismaClient(connectionString: string): PrismaClient {
  const adapter = new PrismaPg({
    connectionString,
    // Without a timeout, an unreachable database would make /api/health hang forever.
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

export async function isDatabaseUp(prisma: PrismaClient): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
