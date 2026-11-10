import { describe, expect, it } from 'vitest';
import { pickQuantities, type RawQuantity } from './quantities.js';

const q = (
  setName: string,
  name: string,
  kind: RawQuantity['kind'],
  value: number,
): RawQuantity => ({
  setName,
  name,
  kind,
  value,
});

describe('pickQuantities', () => {
  it('prefers net over gross values', () => {
    const result = pickQuantities([
      q('Qto_WallBaseQuantities', 'GrossVolume', 'volume', 3),
      q('Qto_WallBaseQuantities', 'NetVolume', 'volume', 2.5),
      q('Qto_WallBaseQuantities', 'GrossSideArea', 'area', 12),
      q('Qto_WallBaseQuantities', 'NetSideArea', 'area', 10),
    ]);
    expect(result).toEqual({ volume: 2.5, area: 10, length: null });
  });

  it('uses the side area of a wall, not its footprint', () => {
    const result = pickQuantities([
      q('BaseQuantities', 'NetFootprintArea', 'area', 1),
      q('BaseQuantities', 'NetSideArea', 'area', 10.4),
    ]);
    expect(result.area).toBe(10.4);
  });

  it('accepts the IFC2x3-style BaseQuantities set name', () => {
    expect(pickQuantities([q('BaseQuantities', 'Length', 'length', 4.17)]).length).toBe(4.17);
  });

  it('prefers standard sets over vendor sets with the same quantity name', () => {
    const result = pickQuantities([
      q('ArchiCADQuantities', 'NetVolume', 'volume', 99),
      q('BaseQuantities', 'NetVolume', 'volume', 2.5),
    ]);
    expect(result.volume).toBe(2.5);
  });

  it('falls back to vendor sets when no standard set provides the quantity', () => {
    expect(pickQuantities([q('CustomQto', 'Volume', 'volume', 1.2)]).volume).toBe(1.2);
  });

  it('returns null instead of inventing a value', () => {
    expect(pickQuantities([])).toEqual({ volume: null, area: null, length: null });
    // A name match with the wrong kind does not count.
    expect(pickQuantities([q('BaseQuantities', 'Length', 'count', 3)]).length).toBeNull();
  });

  it('ignores negative and non-finite values', () => {
    const result = pickQuantities([
      q('BaseQuantities', 'NetVolume', 'volume', -1),
      q('BaseQuantities', 'GrossVolume', 'volume', Number.NaN),
    ]);
    expect(result.volume).toBeNull();
  });
});
