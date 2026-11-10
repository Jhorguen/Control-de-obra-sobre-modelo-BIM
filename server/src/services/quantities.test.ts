import { describe, expect, it } from 'vitest';
import { groupQuantities, type QuantityElement } from './quantities.js';

const el = (overrides: Partial<QuantityElement> & { globalId: string }): QuantityElement => ({
  ifcClass: 'IfcWall',
  typeName: 'Muro 20 cm',
  level: 'Piso 1',
  volume: null,
  area: null,
  length: null,
  ...overrides,
});

describe('groupQuantities', () => {
  it('groups by class, type and level and sums each quantity', () => {
    const result = groupQuantities([
      el({ globalId: 'a', volume: 2, area: 10, length: 4 }),
      el({ globalId: 'b', volume: 3, area: 12, length: 5 }),
      el({ globalId: 'c', level: 'Piso 2', volume: 1, area: 5, length: 2 }),
    ]);
    expect(result.groups).toHaveLength(2);
    expect(result.groups[0]).toMatchObject({
      ifcClass: 'IfcWall',
      level: 'Piso 1',
      count: 2,
      volume: 5,
      area: 22,
      length: 9,
      globalIds: ['a', 'b'],
    });
    expect(result.groups[1]).toMatchObject({ level: 'Piso 2', count: 1, volume: 1 });
  });

  it('counts elements without a quantity instead of treating them as zero', () => {
    const result = groupQuantities([
      el({ globalId: 'a', volume: 2 }),
      el({ globalId: 'b', volume: null }),
    ]);
    expect(result.groups[0]).toMatchObject({ count: 2, volume: 2, withoutVolume: 1 });
    expect(result.totals).toMatchObject({ count: 2, volume: 2, withoutVolume: 1 });
  });

  it('computes subtotals per IFC class and an overall total', () => {
    const result = groupQuantities([
      el({ globalId: 'a', volume: 2 }),
      el({ globalId: 'b', level: 'Piso 2', volume: 3 }),
      el({ globalId: 'c', ifcClass: 'IfcSlab', typeName: 'Losa', volume: 10 }),
    ]);
    expect(result.classTotals).toEqual([
      expect.objectContaining({ ifcClass: 'IfcSlab', count: 1, volume: 10 }),
      expect.objectContaining({ ifcClass: 'IfcWall', count: 2, volume: 5 }),
    ]);
    expect(result.totals).toMatchObject({ count: 3, volume: 15 });
  });

  it('sorts by class, then type and level with missing values last', () => {
    const result = groupQuantities([
      el({ globalId: 'a', ifcClass: 'IfcWall', typeName: null }),
      el({ globalId: 'b', ifcClass: 'IfcWall', typeName: 'A' }),
      el({ globalId: 'c', ifcClass: 'IfcDoor', level: null }),
      el({ globalId: 'd', ifcClass: 'IfcDoor', level: 'Piso 1' }),
    ]);
    expect(result.groups.map((g) => g.globalIds[0])).toEqual(['d', 'c', 'b', 'a']);
  });

  it('removes floating point noise from the sums', () => {
    const result = groupQuantities([
      el({ globalId: 'a', volume: 0.1 }),
      el({ globalId: 'b', volume: 0.2 }),
    ]);
    expect(result.totals.volume).toBe(0.3);
  });

  it('returns empty groups and zero totals for a project without elements', () => {
    expect(groupQuantities([])).toEqual({
      groups: [],
      classTotals: [],
      totals: {
        count: 0,
        volume: 0,
        area: 0,
        length: 0,
        withoutVolume: 0,
        withoutArea: 0,
        withoutLength: 0,
      },
    });
  });
});
