// Unit handling for IFC quantities. IFC files declare their units once (IfcUnitAssignment);
// a model exported in millimetres stores a 4.17 m wall length as 4170. Everything the app
// stores is converted to metres, square metres and cubic metres.

export interface UnitScales {
  /** Multiply a length in model units by this to get metres. */
  length: number;
  /** Multiply an area in model units by this to get square metres. */
  area: number;
  /** Multiply a volume in model units by this to get cubic metres. */
  volume: number;
}

export const SI_SCALES: UnitScales = { length: 1, area: 1, volume: 1 };

const SI_PREFIX_FACTORS: Record<string, number> = {
  EXA: 1e18,
  PETA: 1e15,
  TERA: 1e12,
  GIGA: 1e9,
  MEGA: 1e6,
  KILO: 1e3,
  HECTO: 1e2,
  DECA: 1e1,
  DECI: 1e-1,
  CENTI: 1e-2,
  MILLI: 1e-3,
  MICRO: 1e-6,
  NANO: 1e-9,
  PICO: 1e-12,
  FEMTO: 1e-15,
  ATTO: 1e-18,
};

/**
 * Factor from an IfcSIUnit to the SI base unit, e.g. (MILLI, METRE) -> 0.001 and
 * (MILLI, SQUARE_METRE) -> 0.000001 (the prefix applies to the metre, then it is squared).
 * Returns null for units that are not lengths, areas or volumes.
 */
export function siUnitFactor(name: string, prefix: string | null): number | null {
  const p = prefix ? SI_PREFIX_FACTORS[prefix] : 1;
  if (p === undefined) return null;
  switch (name) {
    case 'METRE':
      return p;
    case 'SQUARE_METRE':
      return p ** 2;
    case 'CUBIC_METRE':
      return p ** 3;
    default:
      return null;
  }
}

export interface UnitDefinition {
  /** IfcUnitEnum value: LENGTHUNIT, AREAUNIT, VOLUMEUNIT... */
  unitType: string;
  /** Factor to metres / m² / m³. */
  factor: number;
}

/** Picks the length, area and volume factors from the project's unit assignment. */
export function resolveScales(units: UnitDefinition[]): UnitScales {
  const find = (type: string) => units.find((u) => u.unitType === type)?.factor;
  return {
    length: find('LENGTHUNIT') ?? 1,
    area: find('AREAUNIT') ?? 1,
    volume: find('VOLUMEUNIT') ?? 1,
  };
}
