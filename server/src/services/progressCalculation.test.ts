import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { CalcItem } from './budgetCalculation.js';
import {
  computeCurve,
  computeProgressSummary,
  statusAt,
  type HistoryEntry,
  type ProgressElement,
} from './progressCalculation.js';

const D = (value: number) => new Prisma.Decimal(value);

const entry = (status: HistoryEntry['status'], date: string, createdAt = `${date}T12:00:00Z`) => ({
  status,
  date,
  createdAt: new Date(createdAt),
});

// One item: concrete at 100 per m³.
const items: CalcItem[] = [
  { id: 1, code: '1', quantitySource: 'VOLUME', factor: D(1), unitPrice: D(100) },
];

const element = (overrides: Partial<ProgressElement> & { id: number }): ProgressElement => ({
  globalId: `G${overrides.id}`,
  ifcClass: 'IfcWall',
  level: 'Piso 1',
  volume: 1,
  area: null,
  length: null,
  budgetItemIds: [1],
  plannedDate: null,
  history: [],
  ...overrides,
});

describe('statusAt', () => {
  it('is PENDING without records', () => {
    expect(statusAt([])).toBe('PENDING');
  });

  it('takes the latest record by date, not by insertion order', () => {
    // A record entered late but dated earlier (backdated) does not override a newer one.
    const history = [
      entry('DONE', '2026-03-10', '2026-03-10T08:00:00Z'),
      entry('IN_PROGRESS', '2026-03-01', '2026-03-12T08:00:00Z'),
    ];
    expect(statusAt(history)).toBe('DONE');
  });

  it('breaks ties on the same day by creation time', () => {
    const history = [
      entry('IN_PROGRESS', '2026-03-10', '2026-03-10T08:00:00Z'),
      entry('DONE', '2026-03-10', '2026-03-10T17:00:00Z'),
    ];
    expect(statusAt(history)).toBe('DONE');
  });

  it('answers the status at a past date', () => {
    const history = [entry('IN_PROGRESS', '2026-03-01'), entry('DONE', '2026-03-10')];
    expect(statusAt(history, '2026-02-28')).toBe('PENDING');
    expect(statusAt(history, '2026-03-05')).toBe('IN_PROGRESS');
    expect(statusAt(history, '2026-03-10')).toBe('DONE');
  });
});

describe('computeProgressSummary', () => {
  it('computes physical (by count) and financial (by value) progress separately', () => {
    // Two cheap elements done, one expensive pending: 67 % of elements but 20 % of the value.
    const summary = computeProgressSummary(items, [
      element({ id: 1, volume: 1, history: [entry('DONE', '2026-03-01')] }),
      element({ id: 2, volume: 1, history: [entry('DONE', '2026-03-02')] }),
      element({ id: 3, volume: 8 }),
    ]);
    expect(summary.budgetTotal).toBe(1000);
    expect(summary.executedValue).toBe(200);
    expect(summary.financialProgress).toBeCloseTo(0.2);
    expect(summary.physicalProgress).toBeCloseTo(2 / 3);
    expect(summary.counts).toEqual({ withItem: 3, pending: 1, inProgress: 0, done: 2 });
  });

  it('does not count work in progress as executed', () => {
    const summary = computeProgressSummary(items, [
      element({ id: 1, history: [entry('IN_PROGRESS', '2026-03-01')] }),
    ]);
    expect(summary.executedValue).toBe(0);
    expect(summary.counts.inProgress).toBe(1);
  });

  it('leaves elements without a budget item out of the measures', () => {
    const summary = computeProgressSummary(items, [
      element({ id: 1, history: [entry('DONE', '2026-03-01')] }),
      element({ id: 2, budgetItemIds: [], history: [entry('PENDING', '2026-03-01')] }),
    ]);
    expect(summary.counts.withItem).toBe(1);
    expect(summary.physicalProgress).toBe(1);
  });

  it('breaks progress down by level', () => {
    const summary = computeProgressSummary(items, [
      element({ id: 1, level: 'Piso 1', history: [entry('DONE', '2026-03-01')] }),
      element({ id: 2, level: 'Piso 2' }),
      element({ id: 3, level: null }),
    ]);
    expect(summary.byLevel.map((l) => [l.level, l.done, l.physicalProgress])).toEqual([
      ['Piso 1', 1, 1],
      ['Piso 2', 0, 0],
      [null, 0, 0],
    ]);
  });

  it('returns zero ratios for a project without budget', () => {
    const summary = computeProgressSummary([], []);
    expect(summary).toMatchObject({ budgetTotal: 0, financialProgress: 0, physicalProgress: 0 });
  });
});

describe('computeCurve', () => {
  it('accumulates planned and executed value at each date of the plan and the log', () => {
    const curve = computeCurve(items, [
      element({
        id: 1,
        volume: 2,
        plannedDate: '2026-03-01',
        history: [entry('DONE', '2026-03-03')],
      }),
      element({ id: 2, volume: 3, plannedDate: '2026-03-05' }),
    ]);
    expect(curve).toEqual([
      { date: '2026-03-01', planned: 200, executed: 0 },
      { date: '2026-03-03', planned: 200, executed: 200 },
      { date: '2026-03-05', planned: 500, executed: 200 },
    ]);
  });

  it('uses the status at each date, so a later rollback lowers the executed line', () => {
    const curve = computeCurve(items, [
      element({
        id: 1,
        history: [entry('DONE', '2026-03-01'), entry('IN_PROGRESS', '2026-03-04')],
      }),
    ]);
    expect(curve.map((p) => p.executed)).toEqual([100, 0]);
  });
});
