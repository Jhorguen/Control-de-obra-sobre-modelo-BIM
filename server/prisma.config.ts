import { existsSync } from 'node:fs';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer loads .env on its own. Node's built-in loader avoids a dotenv dependency.
if (existsSync('.env')) process.loadEnvFile('.env');

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // process.env instead of Prisma's env() helper: env() throws when the variable is missing,
    // which would break `prisma generate` in CI, where there is no database.
    url: process.env['DATABASE_URL'],
  },
});
