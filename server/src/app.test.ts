import { errorResponseSchema, healthResponseSchema } from '@bim/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import type { PrismaClient } from './generated/prisma/client.js';

// These tests never touch the database: the health check is replaced by a stub.
const appWithDatabase = (up: boolean) =>
  createApp({ prisma: {} as PrismaClient, checkDatabase: () => Promise.resolve(up) });

describe('GET /api/health', () => {
  it('answers 200 with status ok when the database responds', async () => {
    const res = await request(appWithDatabase(true)).get('/api/health');

    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body)).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('answers 503 with status degraded when the database is down', async () => {
    const res = await request(appWithDatabase(false)).get('/api/health');

    expect(res.status).toBe(503);
    expect(healthResponseSchema.parse(res.body)).toMatchObject({
      status: 'degraded',
      database: 'down',
    });
  });
});

describe('error format', () => {
  it('answers unknown routes with 404 and the standard error shape', async () => {
    const res = await request(appWithDatabase(true)).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('NOT_FOUND');
  });

  it('answers malformed JSON with 400 INVALID_JSON', async () => {
    const res = await request(appWithDatabase(true))
      .post('/api/health')
      .set('Content-Type', 'application/json')
      .send('{"broken":');

    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('INVALID_JSON');
  });
});
