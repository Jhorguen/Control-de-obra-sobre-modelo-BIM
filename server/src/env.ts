import { existsSync } from 'node:fs';
import { z } from 'zod';

// Node >= 20.12 loads .env files natively; no dotenv dependency needed.
// In production the hosting service injects the variables and there is no .env file.
if (existsSync('.env')) process.loadEnvFile('.env');

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.url(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // Fail fast with a readable message instead of crashing later on the first query.
  console.error('Invalid environment variables:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
