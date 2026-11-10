import {
  assignmentResultSchema,
  budgetItemSchema,
  errorResponseSchema,
  progressHistorySchema,
  progressSummarySchema,
  statusMapSchema,
  type ElementInput,
} from '@bim/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDatabase, testPrisma } from '../test/db.js';

const app = createApp({ prisma: testPrisma });

const element = (globalId: string, volume: number): ElementInput => ({
  globalId,
  ifcClass: 'IfcWall',
  name: globalId,
  typeName: null,
  level: 'Piso 1',
  volume,
  area: null,
  length: null,
});

async function setup() {
  const project = await testPrisma.project.create({ data: { name: 'Obra' } });
  const base = `/api/projects/${project.id}`;
  await request(app)
    .post(`${base}/elements/bulk`)
    .send({ elements: [element('A', 1), element('B', 1), element('C', 8)] });
  const item = budgetItemSchema.parse(
    (
      await request(app).post(`${base}/budget-items`).send({
        code: '1',
        description: 'Concreto',
        unit: 'M3',
        quantitySource: 'VOLUME',
        factor: 1,
        unitPrice: 100,
      })
    ).body,
  );
  await request(app)
    .put(`${base}/elements/assign`)
    .send({ globalIds: ['A', 'B', 'C'], budgetItemId: item.id });
  return { project, base };
}

const progress = (base: string, body: object) => request(app).post(`${base}/progress`).send(body);

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('progress tracking', () => {
  it('records progress and exposes the current status in the status map', async () => {
    const { base } = await setup();
    const res = await progress(base, { globalIds: ['A', 'B'], status: 'DONE', date: '2026-03-02' });
    expect(res.status).toBe(201);
    expect(assignmentResultSchema.parse(res.body).affected).toBe(2);

    const map = statusMapSchema.parse((await request(app).get(`${base}/status-map`)).body);
    const byGuid = Object.fromEntries(map.map((e) => [e.globalId, e.status]));
    expect(byGuid).toEqual({ A: 'DONE', B: 'DONE', C: 'PENDING' });
  });

  it('keeps the full history of an element, newest first', async () => {
    const { base } = await setup();
    await progress(base, { globalIds: ['A'], status: 'IN_PROGRESS', date: '2026-03-01' });
    await progress(base, { globalIds: ['A'], status: 'DONE', date: '2026-03-05', note: 'Fundido' });

    const map = statusMapSchema.parse((await request(app).get(`${base}/status-map`)).body);
    const a = map.find((e) => e.globalId === 'A')!;
    const history = progressHistorySchema.parse(
      (await request(app).get(`/api/elements/${a.id}/progress`)).body,
    );
    expect(history.map((h) => [h.status, h.date, h.note])).toEqual([
      ['DONE', '2026-03-05', 'Fundido'],
      ['IN_PROGRESS', '2026-03-01', null],
    ]);
  });

  it('rejects future dates and invalid statuses', async () => {
    const { base } = await setup();
    const future = await progress(base, { globalIds: ['A'], status: 'DONE', date: '2999-01-01' });
    expect(future.status).toBe(400);
    expect(errorResponseSchema.parse(future.body).error.code).toBe('FUTURE_DATE');
    const invalid = await progress(base, {
      globalIds: ['A'],
      status: 'FINISHED',
      date: '2026-03-01',
    });
    expect(invalid.status).toBe(400);
  });

  it('summarizes physical and financial progress with the S-curve', async () => {
    const { base } = await setup();
    await request(app)
      .put(`${base}/elements/planned-date`)
      .send({ globalIds: ['A', 'B', 'C'], plannedDate: '2026-03-10' });
    await progress(base, { globalIds: ['A', 'B'], status: 'DONE', date: '2026-03-02' });

    const summary = progressSummarySchema.parse((await request(app).get(`${base}/summary`)).body);
    expect(summary).toMatchObject({
      budgetTotal: 1000,
      executedValue: 200,
      financialProgress: 0.2,
      hasPlan: true,
      counts: { withItem: 3, done: 2, pending: 1, inProgress: 0 },
    });
    expect(summary.physicalProgress).toBeCloseTo(2 / 3);
    expect(summary.curve).toEqual([
      { date: '2026-03-02', planned: 0, executed: 200 },
      { date: '2026-03-10', planned: 1000, executed: 200 },
    ]);
  });

  it('answers 404 for the history of a missing element', async () => {
    expect((await request(app).get('/api/elements/999/progress')).status).toBe(404);
  });
});
