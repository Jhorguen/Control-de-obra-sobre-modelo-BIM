import type { QuantitySource } from '@bim/shared';
import { Prisma } from '../generated/prisma/client.js';

// Budget arithmetic as pure functions (no database), so every rule is unit tested.
// Money uses Decimal: 0.1 + 0.2 must be 0.3 when it is pesos.

const Decimal = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export interface CalcItem {
  id: number;
  code: string;
  quantitySource: QuantitySource;
  factor: Decimal;
  unitPrice: Decimal;
}

export interface CalcElement {
  id: number;
  globalId: string;
  ifcClass: string;
  volume: number | null;
  area: number | null;
  length: number | null;
  budgetItemIds: readonly number[];
  /** Current progress status is DONE (only finished work counts as executed). */
  executed: boolean;
}

export interface ItemTotals {
  itemId: number;
  elementCount: number;
  withoutQuantity: number;
  quantity: Decimal;
  subtotal: Decimal;
  executedQuantity: Decimal;
  executedValue: Decimal;
  globalIds: string[];
}

/** Base quantity of an element for a source: m³, m², m, or 1 per element. */
export function baseQuantity(element: CalcElement, source: QuantitySource): number | null {
  switch (source) {
    case 'VOLUME':
      return element.volume;
    case 'AREA':
      return element.area;
    case 'LENGTH':
      return element.length;
    case 'COUNT':
      return 1;
  }
}

/** Quantity an element contributes to an item: base × factor, or null if the IFC lacks it. */
export function elementQuantity(element: CalcElement, item: CalcItem): Decimal | null {
  const base = baseQuantity(element, item.quantitySource);
  return base === null ? null : new Decimal(base).mul(item.factor);
}

/** Budget quantities and money are presented with two decimals, as in a bill of quantities. */
const round2 = (value: Decimal) => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/**
 * Totals of every item: summed quantity (rounded to 2 decimals, then multiplied by the unit
 * price, the way a budget is written) and the part already executed.
 */
export function computeItemTotals(
  items: readonly CalcItem[],
  elements: readonly CalcElement[],
): ItemTotals[] {
  return items.map((item) => {
    let quantity = new Decimal(0);
    let executedQuantity = new Decimal(0);
    let elementCount = 0;
    let withoutQuantity = 0;
    const globalIds: string[] = [];

    for (const element of elements) {
      if (!element.budgetItemIds.includes(item.id)) continue;
      elementCount++;
      globalIds.push(element.globalId);
      const contribution = elementQuantity(element, item);
      if (contribution === null) {
        withoutQuantity++;
        continue;
      }
      quantity = quantity.add(contribution);
      if (element.executed) executedQuantity = executedQuantity.add(contribution);
    }

    const roundedQuantity = round2(quantity);
    const roundedExecuted = round2(executedQuantity);
    return {
      itemId: item.id,
      elementCount,
      withoutQuantity,
      quantity: roundedQuantity,
      subtotal: round2(roundedQuantity.mul(item.unitPrice)),
      executedQuantity: roundedExecuted,
      executedValue: round2(roundedExecuted.mul(item.unitPrice)),
      globalIds,
    };
  });
}

export function sumDecimals(values: readonly Decimal[]): Decimal {
  return values.reduce((total, value) => total.add(value), new Decimal(0));
}

export interface ElementGroupSummary {
  count: number;
  globalIds: string[];
  byClass: { ifcClass: string; count: number }[];
}

export function summarizeGroup(elements: readonly CalcElement[]): ElementGroupSummary {
  const byClass = new Map<string, number>();
  for (const element of elements) {
    byClass.set(element.ifcClass, (byClass.get(element.ifcClass) ?? 0) + 1);
  }
  return {
    count: elements.length,
    globalIds: elements.map((e) => e.globalId),
    byClass: [...byClass.entries()]
      .map(([ifcClass, count]) => ({ ifcClass, count }))
      .sort((a, b) => b.count - a.count || a.ifcClass.localeCompare(b.ifcClass)),
  };
}

/** Elements without any budget item: listed apart so they are not silently left out. */
export function unassignedElements(elements: readonly CalcElement[]): CalcElement[] {
  return elements.filter((e) => e.budgetItemIds.length === 0);
}

/** Elements assigned to at least one item whose quantity their IFC does not provide. */
export function elementsWithoutQuantity(
  items: readonly CalcItem[],
  elements: readonly CalcElement[],
): CalcElement[] {
  const itemsById = new Map(items.map((item) => [item.id, item]));
  return elements.filter((element) =>
    element.budgetItemIds.some((id) => {
      const item = itemsById.get(id);
      return item !== undefined && elementQuantity(element, item) === null;
    }),
  );
}
