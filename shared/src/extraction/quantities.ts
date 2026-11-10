// Chooses the volume, area and length of an element from its IfcElementQuantity sets.

export type QuantityKind = 'volume' | 'area' | 'length' | 'count' | 'weight';

export interface RawQuantity {
  /** Name of the IfcElementQuantity, e.g. Qto_WallBaseQuantities or BaseQuantities. */
  setName: string;
  /** Name of the quantity, e.g. NetVolume. */
  name: string;
  kind: QuantityKind;
  /** Value already converted to SI units (m, m², m³). */
  value: number;
}

export interface ElementQuantities {
  volume: number | null;
  area: number | null;
  length: number | null;
}

/**
 * Quantity names by preference. Net values (openings deducted) win over gross ones.
 * For walls the side area is the useful one (plaster, paint, formwork); slabs only have
 * NetArea/GrossArea; columns and beams expose surface areas.
 */
export const QUANTITY_PRIORITY: Record<'volume' | 'area' | 'length', readonly string[]> = {
  volume: ['NetVolume', 'GrossVolume', 'Volume'],
  area: [
    'NetSideArea',
    'NetArea',
    'GrossSideArea',
    'GrossArea',
    'Area',
    'NetSurfaceArea',
    'OuterSurfaceArea',
    'GrossSurfaceArea',
  ],
  length: ['Length', 'NetLength', 'GrossLength'],
};

/** Sets defined by the IFC standard. IFC4 names them Qto_*; IFC2x3 exports use BaseQuantities. */
export function isStandardQuantitySet(setName: string): boolean {
  return setName.startsWith('Qto_') || setName === 'BaseQuantities';
}

function pick(quantities: RawQuantity[], kind: 'volume' | 'area' | 'length'): number | null {
  const candidates = quantities.filter(
    (q) => q.kind === kind && Number.isFinite(q.value) && q.value >= 0,
  );
  // Standard sets first: vendor sets (e.g. ArchiCADQuantities) may reuse names with
  // different meanings, so they are only a fallback.
  const groups = [candidates.filter((q) => isStandardQuantitySet(q.setName)), candidates];
  for (const group of groups) {
    for (const name of QUANTITY_PRIORITY[kind]) {
      const match = group.find((q) => q.name === name);
      if (match) return match.value;
    }
  }
  return null;
}

/** Returns null for a quantity the model does not provide: values are never invented. */
export function pickQuantities(quantities: RawQuantity[]): ElementQuantities {
  return {
    volume: pick(quantities, 'volume'),
    area: pick(quantities, 'area'),
    length: pick(quantities, 'length'),
  };
}
