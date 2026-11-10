import { describe, expect, it } from 'vitest';
import { resolveScales, siUnitFactor } from './units.js';

describe('siUnitFactor', () => {
  it('applies the prefix to the metre before squaring or cubing it', () => {
    expect(siUnitFactor('METRE', 'MILLI')).toBeCloseTo(1e-3);
    expect(siUnitFactor('SQUARE_METRE', 'MILLI')).toBeCloseTo(1e-6);
    expect(siUnitFactor('CUBIC_METRE', 'CENTI')).toBeCloseTo(1e-6);
  });

  it('returns 1 for unprefixed SI units and null for non-geometric units', () => {
    expect(siUnitFactor('METRE', null)).toBe(1);
    expect(siUnitFactor('SECOND', null)).toBeNull();
    expect(siUnitFactor('METRE', 'UNKNOWN')).toBeNull();
  });
});

describe('resolveScales', () => {
  it('picks length, area and volume factors from the unit assignment', () => {
    const scales = resolveScales([
      { unitType: 'LENGTHUNIT', factor: 0.001 },
      { unitType: 'AREAUNIT', factor: 1 },
      { unitType: 'VOLUMEUNIT', factor: 1 },
    ]);
    expect(scales).toEqual({ length: 0.001, area: 1, volume: 1 });
  });

  it('defaults to SI when a unit is not declared', () => {
    expect(resolveScales([])).toEqual({ length: 1, area: 1, volume: 1 });
  });
});
