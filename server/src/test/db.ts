import { createPrismaClient } from '../db.js';

// Tests use their own database (never the development one): they truncate every table.
export const TEST_DATABASE_URL =
  process.env['TEST_DATABASE_URL'] ?? 'postgresql://bim:bim@localhost:5432/bim_test?schema=public';

export const testPrisma = createPrismaClient(TEST_DATABASE_URL);

const TABLES = [
  'progress_records',
  'element_budget_items',
  'budget_items',
  'elements',
  'model_files',
  'projects',
];

export async function resetDatabase(): Promise<void> {
  await testPrisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`,
  );
}
