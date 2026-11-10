import { z } from 'zod';

export const healthResponseSchema = z.object({
  /** `ok` when every dependency responds; `degraded` when the database does not. */
  status: z.enum(['ok', 'degraded']),
  database: z.enum(['up', 'down']),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
