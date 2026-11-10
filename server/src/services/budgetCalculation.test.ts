import { describe, expect, it } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import {
  computeItemTotals,
  elementQuantity,
  elementsWithoutQuantity,
  summarizeGroup,
  unassignedElements,
  type CalcElement,
  type CalcItem,
} from './budgetCalculation.js';

const D = (value: number | string) => new Prisma.Decimal(value);

const item = (overrides: Partial<CalcItem> & { id: number }): CalcItem => ({
  code: `1.${overrides.id}`,
  quantitySource: 'VOLUME',
  factor: D(1),
  unitPrice: D(100),
  ...overrides,
});

const element = (overrides: Partial<CalcElement> & { id: number }): CalcElement => ({
  globalId: `G${overrides.id}`,
  ifcClass: 'IfcWall',
  volume: 2,
  area: 10,
  length: 4,
  budgetItemIds: [],
  executed: false,
  ...overrides,
});

describe('elementQuantity', () => {
  it('takes the quantity matching the item source and applies the factor', () => {
    const wall = element({ id: 1, volume: 2.5, area: 10.4, length: 4.17 });
    expect(elementQuantity(wall, item({ id: 1, quantitySource: 'VOLUME' }))?.toNumber()).toBe(2.5);
    // Rebar: 90 kg per m³ of concrete.
    expect(
      elementQuantity(wall, item({ id: 2, quantitySource: 'VOLUME', factor: D(90) }))?.toNumber(),
    ).toBe(225);
    // Formwork on both faces.
    expect(
      elementQuantity(wall, item({ id: 3, quantitySource: 'AREA', factor: D(2) }))?.toNumber(),
    ).toBe(20.8);
    expect(elementQuantity(wall, item({ id: 4, quantitySource: 'COUNT' }))?.toNumber()).toBe(1);
  });

  it('returns null when the IFC lacks the needed quantity', () => {
    const member = element({ id: 1, volume: null });
    expect(elementQuantity(member, item({ id: 1, quantitySource: 'VOLUME' }))).toBeNull();
  });
});

describe('computeItemTotals', () => {
  it('sums the assigned elements and multiplies by the unit price', () => {
    const concrete = item({ id: 1, unitPrice: D('450000') });
    const elements = [
      element({ id: 1, volume: 2.5, budgetItemIds: [1] }),
      element({ id: 2, volume: 1.25, budgetItemIds: [1] }),
      element({ id: 3, volume: 99 }), // not assigned
    ];
    const [totals] = computeItemTotals([concrete], elements);
    expect(totals?.elementCount).toBe(2);
    expect(totals?.quantity.toNumber()).toBe(3.75);
    expect(totals?.subtotal.toNumber()).toBe(1_687_500);
    expect(totals?.globalIds).toEqual(['G1', 'G2']);
  });

  it('rounds the quantity to two decimals before pricing it, like a bill of quantities', () => {
    const priced = item({ id: 1, unitPrice: D(1000) });
    const [totals] = computeItemTotals(
      [priced],
      [element({ id: 1, volume: 1.004, budgetItemIds: [1] })],
    );
    expect(totals?.quantity.toNumber()).toBe(1);
    expect(totals?.subtotal.toNumber()).toBe(1000);
  });

  it('uses exact decimal arithmetic for money', () => {
    const priced = item({ id: 1, quantitySource: 'COUNT', unitPrice: D('0.1') });
    const elements = [1, 2, 3].map((id) => element({ id, budgetItemIds: [1] }));
    const [totals] = computeItemTotals([priced], elements);
    expect(totals?.subtotal.toString()).toBe('0.3');
  });

  it('recomputes the subtotal when the unit price changes', () => {
    const elements = [element({ id: 1, volume: 2, budgetItemIds: [1] })];
    const before = computeItemTotals([item({ id: 1, unitPrice: D(100) })], elements)[0];
    const after = computeItemTotals([item({ id: 1, unitPrice: D(150) })], elements)[0];
    expect(before?.subtotal.toNumber()).toBe(200);
    expect(after?.subtotal.toNumber()).toBe(300);
  });

  it('counts elements without the quantity apart and does not add them', () => {
    const [totals] = computeItemTotals(
      [item({ id: 1 })],
      [
        element({ id: 1, volume: 2, budgetItemIds: [1] }),
        element({ id: 2, volume: null, budgetItemIds: [1] }),
      ],
    );
    expect(totals).toMatchObject({ elementCount: 2, withoutQuantity: 1 });
    expect(totals?.quantity.toNumber()).toBe(2);
  });

  it('computes the executed quantity and value from finished elements only', () => {
    const [totals] = computeItemTotals(
      [item({ id: 1, unitPrice: D(100) })],
      [
        element({ id: 1, volume: 2, budgetItemIds: [1], executed: true }),
        element({ id: 2, volume: 3, budgetItemIds: [1], executed: false }),
      ],
    );
    expect(totals?.executedQuantity.toNumber()).toBe(2);
    expect(totals?.executedValue.toNumber()).toBe(200);
    expect(totals?.subtotal.toNumber()).toBe(500);
  });

  it('lets one element feed several items (concrete, rebar, formwork)', () => {
    const items = [
      item({ id: 1, quantitySource: 'VOLUME', unitPrice: D(450000) }),
      item({ id: 2, quantitySource: 'VOLUME', factor: D(90), unitPrice: D(5000) }),
      item({ id: 3, quantitySource: 'AREA', factor: D(2), unitPrice: D(30000) }),
    ];
    const wall = element({ id: 1, volume: 2, area: 10, budgetItemIds: [1, 2, 3] });
    const totals = computeItemTotals(items, [wall]);
    expect(totals.map((t) => t.subtotal.toNumber())).toEqual([900_000, 900_000, 600_000]);
  });
});

describe('unassigned and missing quantities', () => {
  it('lists elements without any item and elements that cannot be quantified', () => {
    const items = [item({ id: 1, quantitySource: 'VOLUME' })];
    const elements = [
      element({ id: 1, budgetItemIds: [1] }),
      element({ id: 2, budgetItemIds: [] }),
      element({ id: 3, ifcClass: 'IfcMember', volume: null, budgetItemIds: [1] }),
    ];
    expect(unassignedElements(elements).map((e) => e.id)).toEqual([2]);
    expect(elementsWithoutQuantity(items, elements).map((e) => e.id)).toEqual([3]);
  });

  it('summarizes a group by IFC class', () => {
    const summary = summarizeGroup([
      element({ id: 1, ifcClass: 'IfcMember' }),
      element({ id: 2, ifcClass: 'IfcMember' }),
      element({ id: 3, ifcClass: 'IfcStair' }),
    ]);
    expect(summary).toEqual({
      count: 3,
      globalIds: ['G1', 'G2', 'G3'],
      byClass: [
        { ifcClass: 'IfcMember', count: 2 },
        { ifcClass: 'IfcStair', count: 1 },
      ],
    });
  });
});
