import type { ClassTotal, QuantitiesResponse, QuantityGroup, QuantitySums } from '@bim/shared';

export interface QuantityElement {
  globalId: string;
  ifcClass: string;
  typeName: string | null;
  level: string | null;
  volume: number | null;
  area: number | null;
  length: number | null;
}

const emptySums = (): QuantitySums => ({
  count: 0,
  volume: 0,
  area: 0,
  length: 0,
  withoutVolume: 0,
  withoutArea: 0,
  withoutLength: 0,
});

/** Adds one element: known quantities are summed, missing ones are counted, never guessed. */
function add(sums: QuantitySums, element: QuantityElement): void {
  sums.count++;
  if (element.volume === null) sums.withoutVolume++;
  else sums.volume += element.volume;
  if (element.area === null) sums.withoutArea++;
  else sums.area += element.area;
  if (element.length === null) sums.withoutLength++;
  else sums.length += element.length;
}

/** Floating point sums drift (0.1 + 0.2); six decimals is far below construction precision. */
const round = (value: number) => Math.round(value * 1e6) / 1e6;

function rounded<T extends QuantitySums>(sums: T): T {
  return {
    ...sums,
    volume: round(sums.volume),
    area: round(sums.area),
    length: round(sums.length),
  };
}

/** Sorts text ascending with nulls ("no type", "no level") at the end. */
function compareNullable(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a.localeCompare(b, 'es');
}

/**
 * Groups elements by IFC class, type and level, the way a quantity takeoff is read:
 * "IfcWall / Muro 20 cm / Piso 1: 12 elements, 34.5 m³".
 */
export function groupQuantities(elements: readonly QuantityElement[]): QuantitiesResponse {
  const groups = new Map<string, QuantityGroup>();
  const classTotals = new Map<string, ClassTotal>();
  const totals = emptySums();

  for (const element of elements) {
    const key = JSON.stringify([element.ifcClass, element.typeName, element.level]);
    let group = groups.get(key);
    if (!group) {
      group = {
        ifcClass: element.ifcClass,
        typeName: element.typeName,
        level: element.level,
        globalIds: [],
        ...emptySums(),
      };
      groups.set(key, group);
    }
    add(group, element);
    group.globalIds.push(element.globalId);

    let classTotal = classTotals.get(element.ifcClass);
    if (!classTotal) {
      classTotal = { ifcClass: element.ifcClass, ...emptySums() };
      classTotals.set(element.ifcClass, classTotal);
    }
    add(classTotal, element);
    add(totals, element);
  }

  return {
    groups: [...groups.values()]
      .sort(
        (a, b) =>
          a.ifcClass.localeCompare(b.ifcClass) ||
          compareNullable(a.typeName, b.typeName) ||
          compareNullable(a.level, b.level),
      )
      .map(rounded),
    classTotals: [...classTotals.values()]
      .sort((a, b) => a.ifcClass.localeCompare(b.ifcClass))
      .map(rounded),
    totals: rounded(totals),
  };
}
