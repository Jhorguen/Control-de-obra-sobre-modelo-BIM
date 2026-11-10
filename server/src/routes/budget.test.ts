import {
  assignmentResultSchema,
  budgetItemListSchema,
  budgetItemSchema,
  budgetResponseSchema,
  errorResponseSchema,
  type BudgetItemInput,
  type ElementInput,
} from '@bim/shared';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resetDatabase, testPrisma } from '../test/db.js';

const app = createApp({ prisma: testPrisma });

const concrete: BudgetItemInput = {
  code: '2.1',
  description: 'Concreto muros 3000 psi',
  unit: 'M3',
  quantitySource: 'VOLUME',
  factor: 1,
  unitPrice: 450_000,
};

const element = (globalId: string, overrides: Partial<ElementInput> = {}): ElementInput => ({
  globalId,
  ifcClass: 'IfcWall',
  name: globalId,
  typeName: 'Muro 24',
  level: 'Piso 1',
  volume: 2,
  area: 10,
  length: 4,
  ...overrides,
});

async function setup() {
  const project = await testPrisma.project.create({ data: { name: 'Proyecto' } });
  await request(app)
    .post(`/api/projects/${project.id}/elements/bulk`)
    .send({
      elements: [
        element('W1'),
        element('W2', { volume: 3 }),
        element('M1', { ifcClass: 'IfcMember', volume: null }),
        element('D1', { ifcClass: 'IfcDoor' }),
      ],
    });
  const res = await request(app).post(`/api/projects/${project.id}/budget-items`).send(concrete);
  return { project, item: budgetItemSchema.parse(res.body) };
}

const assign = (projectId: number, globalIds: string[], budgetItemId: number) =>
  request(app).put(`/api/projects/${projectId}/elements/assign`).send({ globalIds, budgetItemId });

const budgetOf = async (projectId: number) =>
  budgetResponseSchema.parse((await request(app).get(`/api/projects/${projectId}/budget`)).body);

beforeEach(resetDatabase);
afterAll(() => testPrisma.$disconnect());

describe('budget items CRUD', () => {
  it('creates, lists (in natural code order), updates and deletes items', async () => {
    const { project, item } = await setup();
    expect(item).toMatchObject({ code: '2.1', unitPrice: 450_000, factor: 1 });

    await request(app)
      .post(`/api/projects/${project.id}/budget-items`)
      .send({ ...concrete, code: '2.10' });
    await request(app)
      .post(`/api/projects/${project.id}/budget-items`)
      .send({ ...concrete, code: '2.2' });
    const list = budgetItemListSchema.parse(
      (await request(app).get(`/api/projects/${project.id}/budget-items`)).body,
    );
    expect(list.map((i) => i.code)).toEqual(['2.1', '2.2', '2.10']);

    const updated = await request(app)
      .put(`/api/budget-items/${item.id}`)
      .send({ ...concrete, unitPrice: 480_000.456 });
    expect(budgetItemSchema.parse(updated.body).unitPrice).toBe(480_000.46);

    expect((await request(app).delete(`/api/budget-items/${item.id}`)).status).toBe(204);
    expect((await request(app).delete(`/api/budget-items/${item.id}`)).status).toBe(404);
  });

  it('rejects a duplicated code with 409', async () => {
    const { project } = await setup();
    const res = await request(app).post(`/api/projects/${project.id}/budget-items`).send(concrete);
    expect(res.status).toBe(409);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('DUPLICATE_CODE');
  });

  it('validates the input', async () => {
    const { project } = await setup();
    const res = await request(app)
      .post(`/api/projects/${project.id}/budget-items`)
      .send({ ...concrete, code: 'X', unit: 'TON', unitPrice: -1 });
    expect(res.status).toBe(400);
  });
});

describe('assignment and budget', () => {
  it('assigns items by GlobalId and computes quantity, subtotal and total', async () => {
    const { project, item } = await setup();
    const res = await assign(project.id, ['W1', 'W2', 'W2', 'NOPE'], item.id);
    expect(assignmentResultSchema.parse(res.body).affected).toBe(2);
    // Assigning again is harmless.
    expect(assignmentResultSchema.parse((await assign(project.id, ['W1'], item.id)).body)).toEqual({
      affected: 0,
    });

    const budget = await budgetOf(project.id);
    expect(budget.lines[0]).toMatchObject({ elementCount: 2, quantity: 5, subtotal: 2_250_000 });
    expect(budget.total).toBe(2_250_000);
  });

  it('recalculates the total when a unit price changes', async () => {
    const { project, item } = await setup();
    await assign(project.id, ['W1', 'W2'], item.id);
    await request(app)
      .put(`/api/budget-items/${item.id}`)
      .send({ ...concrete, unitPrice: 500_000 });
    expect((await budgetOf(project.id)).total).toBe(2_500_000);
  });

  it('lists unassigned elements and elements without the needed quantity apart', async () => {
    const { project, item } = await setup();
    await assign(project.id, ['W1', 'W2', 'M1'], item.id);
    const budget = await budgetOf(project.id);
    expect(budget.unassigned).toMatchObject({ count: 1, globalIds: ['D1'] });
    expect(budget.withoutQuantity).toMatchObject({ count: 1, globalIds: ['M1'] });
    expect(budget.lines[0]).toMatchObject({ elementCount: 3, withoutQuantity: 1, quantity: 5 });
  });

  it('unassigns items', async () => {
    const { project, item } = await setup();
    await assign(project.id, ['W1', 'W2'], item.id);
    const res = await request(app)
      .put(`/api/projects/${project.id}/elements/unassign`)
      .send({ globalIds: ['W2'], budgetItemId: item.id });
    expect(assignmentResultSchema.parse(res.body).affected).toBe(1);
    expect((await budgetOf(project.id)).total).toBe(900_000);
  });

  it('refuses items from another project', async () => {
    const { item } = await setup();
    const other = await testPrisma.project.create({ data: { name: 'Otro' } });
    const res = await assign(other.id, ['W1'], item.id);
    expect(res.status).toBe(400);
    expect(errorResponseSchema.parse(res.body).error.code).toBe('ITEM_FROM_OTHER_PROJECT');
  });
});
