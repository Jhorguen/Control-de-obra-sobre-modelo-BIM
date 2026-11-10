import {
  bulkElementsResultSchema,
  elementsPageSchema,
  quantitiesResponseSchema,
  type ElementInput,
} from '@bim/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDatabase, testPrisma } from '../test/db.js';

const app = createApp({ prisma: testPrisma });

const wall = (globalId: string, overrides: Partial<ElementInput> = {}): ElementInput => ({
  globalId,
  ifcClass: 'IfcWallStandardCase',
  name: `Muro ${globalId}`,
  typeName: 'Muro 24 cm',
  level: 'Piso 1',
  volume: 2.5,
  area: 10,
  length: 4,
  ...overrides,
});

async function newProject() {
  return testPrisma.project.create({ data: { name: 'Proyecto' } });
}

const bulk = (projectId: number, elements: ElementInput[]) =>
  request(app).post(`/api/projects/${projectId}/elements/bulk`).send({ elements });

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('POST /projects/:id/elements/bulk', () => {
  it('inserts new elements and reports what happened', async () => {
    const project = await newProject();
    const res = await bulk(project.id, [wall('A'), wall('B')]);
    expect(res.status).toBe(200);
    expect(bulkElementsResultSchema.parse(res.body)).toEqual({
      received: 2,
      created: 2,
      updated: 0,
      removed: 0,
      duplicatesIgnored: 0,
    });
  });

  it('does not duplicate elements when the same model is imported twice', async () => {
    const project = await newProject();
    await bulk(project.id, [wall('A'), wall('B')]);
    const second = await bulk(project.id, [wall('A', { volume: 3 }), wall('B')]);

    expect(bulkElementsResultSchema.parse(second.body)).toMatchObject({ created: 0, updated: 2 });
    expect(await testPrisma.element.count({ where: { projectId: project.id } })).toBe(2);
    const a = await testPrisma.element.findFirstOrThrow({ where: { globalId: 'A' } });
    expect(a.volume).toBe(3);
  });

  it('marks elements missing from a new version as removed and restores them if they return', async () => {
    const project = await newProject();
    await bulk(project.id, [wall('A'), wall('B')]);

    const withoutB = await bulk(project.id, [wall('A')]);
    expect(bulkElementsResultSchema.parse(withoutB.body).removed).toBe(1);
    const b = await testPrisma.element.findFirstOrThrow({ where: { globalId: 'B' } });
    expect(b.removedAt).not.toBeNull();

    await bulk(project.id, [wall('A'), wall('B')]);
    const restored = await testPrisma.element.findFirstOrThrow({ where: { globalId: 'B' } });
    expect(restored.removedAt).toBeNull();
  });

  it('ignores duplicated GlobalIds inside one payload', async () => {
    const project = await newProject();
    const res = await bulk(project.id, [wall('A'), wall('A', { volume: 99 })]);
    expect(bulkElementsResultSchema.parse(res.body)).toMatchObject({
      created: 1,
      duplicatesIgnored: 1,
    });
  });

  it('keeps null quantities as null', async () => {
    const project = await newProject();
    await bulk(project.id, [wall('A', { volume: null, area: null, length: null })]);
    const a = await testPrisma.element.findFirstOrThrow({ where: { globalId: 'A' } });
    expect([a.volume, a.area, a.length]).toEqual([null, null, null]);
  });

  it('rejects invalid elements and the demo project', async () => {
    const project = await newProject();
    const invalid = await bulk(project.id, [wall('A', { volume: -1 })]);
    expect(invalid.status).toBe(400);

    const demo = await testPrisma.project.create({ data: { name: 'Demo', isDemo: true } });
    expect((await bulk(demo.id, [wall('A')])).status).toBe(403);
  });

  it('accepts payloads larger than the default 100 kB JSON limit', async () => {
    const project = await newProject();
    const many = Array.from({ length: 3000 }, (_, i) => wall(`G${i}`));
    const res = await bulk(project.id, many);
    expect(res.status).toBe(200);
    expect(bulkElementsResultSchema.parse(res.body).created).toBe(3000);
  });
});

describe('GET /projects/:id/elements and /quantities', () => {
  it('lists active elements with pagination and filters', async () => {
    const project = await newProject();
    await bulk(project.id, [
      wall('A'),
      wall('B', { level: 'Piso 2' }),
      wall('C', { ifcClass: 'IfcSlab' }),
    ]);
    await bulk(project.id, [wall('A'), wall('B', { level: 'Piso 2' })]); // C removed

    const all = elementsPageSchema.parse(
      (await request(app).get(`/api/projects/${project.id}/elements?pageSize=1`)).body,
    );
    expect(all).toMatchObject({ total: 2, page: 1, pageSize: 1 });
    expect(all.items).toHaveLength(1);

    const filtered = elementsPageSchema.parse(
      (await request(app).get(`/api/projects/${project.id}/elements?level=Piso%202`)).body,
    );
    expect(filtered.items.map((e) => e.globalId)).toEqual(['B']);
  });

  it('groups quantities of active elements only', async () => {
    const project = await newProject();
    await bulk(project.id, [wall('A'), wall('B'), wall('C', { level: 'Piso 2', volume: null })]);
    await bulk(project.id, [wall('A'), wall('C', { level: 'Piso 2', volume: null })]); // B removed

    const res = await request(app).get(`/api/projects/${project.id}/quantities`);
    const body = quantitiesResponseSchema.parse(res.body);
    expect(body.groups.map((g) => [g.level, g.count, g.volume, g.withoutVolume])).toEqual([
      ['Piso 1', 1, 2.5, 0],
      ['Piso 2', 1, 0, 1],
    ]);
    expect(body.totals).toMatchObject({ count: 2, volume: 2.5, withoutVolume: 1 });
  });
});
