import * as WebIFC from 'web-ifc';
import { pickQuantities, type QuantityKind, type RawQuantity } from './quantities.js';
import { resolveScales, siUnitFactor, type UnitDefinition, type UnitScales } from './units.js';

/**
 * The part of web-ifc's IfcAPI this module uses. Depending on this contract instead of the
 * class lets the browser build and the Node build of web-ifc (different type declarations)
 * both be passed in.
 */
export interface IfcApiLike {
  OpenModel(data: Uint8Array): number;
  CloseModel(modelID: number): void;
  GetModelSchema(modelID: number): string;
  GetLine(modelID: number, expressID: number): unknown;
  GetLineIDsWithType(
    modelID: number,
    type: number,
    includeInherited?: boolean,
  ): { size(): number; get(index: number): number };
  GetIfcEntityList(modelID: number): number[];
  IsIfcElement(type: number): boolean;
  GetNameFromTypeCode(type: number): string;
}

/** One physical element as stored by the API. */
export interface ExtractedElement {
  globalId: string;
  ifcClass: string;
  name: string | null;
  typeName: string | null;
  level: string | null;
  volume: number | null;
  area: number | null;
  length: number | null;
}

export interface ExtractionResult {
  schema: string;
  scales: UnitScales;
  elements: ExtractedElement[];
  /** Elements skipped because they have no geometry of their own (e.g. aggregates). */
  skippedWithoutGeometry: number;
}

/**
 * IfcAPI.IsIfcElement() is true for these too, but they are not things that get built:
 * openings and features are voids, spaces and the spatial structure are containers.
 */
const EXCLUDED_CLASSES = new Set([
  'IFCOPENINGELEMENT',
  'IFCOPENINGSTANDARDCASE',
  'IFCVOIDINGFEATURE',
  'IFCPROJECTIONELEMENT',
  'IFCSURFACEFEATURE',
  'IFCFEATUREELEMENT',
  'IFCFEATUREELEMENTADDITION',
  'IFCFEATUREELEMENTSUBTRACTION',
  'IFCVIRTUALELEMENT',
  'IFCSPACE',
  'IFCSPATIALZONE',
  'IFCEXTERNALSPATIALELEMENT',
  'IFCSITE',
  'IFCBUILDING',
  'IFCBUILDINGSTOREY',
  'IFCANNOTATION',
  'IFCGRID',
  'IFCDISTRIBUTIONPORT',
]);

const QUANTITY_TYPES: Record<number, { kind: QuantityKind; attribute: string }> = {
  [WebIFC.IFCQUANTITYVOLUME]: { kind: 'volume', attribute: 'VolumeValue' },
  [WebIFC.IFCQUANTITYAREA]: { kind: 'area', attribute: 'AreaValue' },
  [WebIFC.IFCQUANTITYLENGTH]: { kind: 'length', attribute: 'LengthValue' },
  [WebIFC.IFCQUANTITYCOUNT]: { kind: 'count', attribute: 'CountValue' },
  [WebIFC.IFCQUANTITYWEIGHT]: { kind: 'weight', attribute: 'WeightValue' },
};

// ---- Helpers to read web-ifc line attributes (GetLine with flatten = false) ----

type Attribute = { value?: unknown; _representationValue?: unknown } | null | undefined;
type Line = Record<string, unknown> & { type: number };

function ref(attr: unknown): number | null {
  const value = (attr as Attribute)?.value;
  return typeof value === 'number' ? value : null;
}

function refs(attr: unknown): number[] {
  return Array.isArray(attr) ? attr.map(ref).filter((id): id is number => id !== null) : [];
}

function str(attr: unknown): string | null {
  const value = (attr as Attribute)?.value;
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Measures come as { _representationValue: 4.17 } in web-ifc 0.0.77; plain { value } elsewhere. */
function num(attr: unknown): number | null {
  const a = attr as Attribute;
  const value = a?._representationValue ?? a?.value;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Extracts every physical element with its quantities from an IFC model that is already
 * open in `api`. Pure reading: the caller owns the IfcAPI instance and the model.
 */
export function extractElements(api: IfcApiLike, modelID: number): ExtractionResult {
  const lineCache = new Map<number, Line>();
  const line = (id: number): Line => {
    let cached = lineCache.get(id);
    if (!cached) {
      cached = api.GetLine(modelID, id) as Line;
      lineCache.set(id, cached);
    }
    return cached;
  };
  const idsOfType = (type: number): number[] => {
    const vector = api.GetLineIDsWithType(modelID, type, false);
    const ids: number[] = [];
    for (let i = 0; i < vector.size(); i++) ids.push(vector.get(i));
    return ids;
  };

  // ---- Units ----
  const unitDefinition = (id: number): UnitDefinition | null => {
    const unit = line(id);
    const unitType = (unit['UnitType'] as Attribute)?.value;
    if (typeof unitType !== 'string') return null;
    if (unit.type === WebIFC.IFCSIUNIT) {
      const name = (unit['Name'] as Attribute)?.value;
      const prefix = (unit['Prefix'] as Attribute)?.value;
      const factor = siUnitFactor(String(name), typeof prefix === 'string' ? prefix : null);
      return factor === null ? null : { unitType, factor };
    }
    if (unit.type === WebIFC.IFCCONVERSIONBASEDUNIT) {
      // e.g. FOOT = 0.3048 × METRE, expressed through an IfcMeasureWithUnit.
      const conversionId = ref(unit['ConversionFactor']);
      if (conversionId === null) return null;
      const conversion = line(conversionId);
      const value = num(conversion['ValueComponent']);
      const baseId = ref(conversion['UnitComponent']);
      const base = baseId === null ? null : unitDefinition(baseId);
      return value === null || !base ? null : { unitType, factor: value * base.factor };
    }
    return null;
  };

  const projectId = idsOfType(WebIFC.IFCPROJECT)[0];
  const unitAssignmentId = projectId === undefined ? null : ref(line(projectId)['UnitsInContext']);
  const projectUnits =
    unitAssignmentId === null
      ? []
      : refs(line(unitAssignmentId)['Units'])
          .map(unitDefinition)
          .filter((u): u is UnitDefinition => u !== null);
  const scales = resolveScales(projectUnits);

  // ---- Relationship indexes, built once ----
  const containedIn = new Map<number, number>(); // element -> spatial structure element
  for (const relId of idsOfType(WebIFC.IFCRELCONTAINEDINSPATIALSTRUCTURE)) {
    const rel = line(relId);
    const structure = ref(rel['RelatingStructure']);
    if (structure === null) continue;
    for (const element of refs(rel['RelatedElements'])) containedIn.set(element, structure);
  }

  const parentOf = new Map<number, number>(); // part -> whole (IfcRelAggregates)
  for (const relId of idsOfType(WebIFC.IFCRELAGGREGATES)) {
    const rel = line(relId);
    const whole = ref(rel['RelatingObject']);
    if (whole === null) continue;
    for (const part of refs(rel['RelatedObjects'])) parentOf.set(part, whole);
  }

  const typeOf = new Map<number, number>(); // occurrence -> IfcTypeObject
  for (const relId of idsOfType(WebIFC.IFCRELDEFINESBYTYPE)) {
    const rel = line(relId);
    const type = ref(rel['RelatingType']);
    if (type === null) continue;
    for (const object of refs(rel['RelatedObjects'])) typeOf.set(object, type);
  }

  const quantitySetsOf = new Map<number, number[]>(); // element -> IfcElementQuantity ids
  for (const relId of idsOfType(WebIFC.IFCRELDEFINESBYPROPERTIES)) {
    const rel = line(relId);
    const definition = ref(rel['RelatingPropertyDefinition']);
    if (definition === null || line(definition).type !== WebIFC.IFCELEMENTQUANTITY) continue;
    for (const object of refs(rel['RelatedObjects'])) {
      const sets = quantitySetsOf.get(object) ?? [];
      sets.push(definition);
      quantitySetsOf.set(object, sets);
    }
  }

  // ---- Level: the storey that contains the element (or the whole it is part of) ----
  const storeyName = (elementId: number): string | null => {
    const seen = new Set<number>();
    let current: number | undefined = elementId;
    while (current !== undefined && !seen.has(current)) {
      seen.add(current);
      const container = containedIn.get(current);
      if (container !== undefined) {
        // Walk up the spatial structure (e.g. a space inside a storey) to the storey.
        let spatial: number | undefined = container;
        while (spatial !== undefined && !seen.has(spatial)) {
          seen.add(spatial);
          const node = line(spatial);
          if (node.type === WebIFC.IFCBUILDINGSTOREY) {
            return str(node['Name']) ?? str(node['LongName']);
          }
          spatial = parentOf.get(spatial);
        }
        return null;
      }
      current = parentOf.get(current);
    }
    return null;
  };

  // ---- Quantities, converted to SI ----
  const quantitiesOf = (elementId: number): RawQuantity[] => {
    const result: RawQuantity[] = [];
    for (const setId of quantitySetsOf.get(elementId) ?? []) {
      const set = line(setId);
      const setName = str(set['Name']) ?? '';
      for (const quantityId of refs(set['Quantities'])) {
        const quantity = line(quantityId);
        const spec = QUANTITY_TYPES[quantity.type];
        const name = str(quantity['Name']);
        const raw = spec ? num(quantity[spec.attribute]) : null;
        if (!spec || !name || raw === null) continue;
        // A quantity may declare its own unit; otherwise the project unit applies.
        const ownUnitId = ref(quantity['Unit']);
        const ownUnit = ownUnitId === null ? null : unitDefinition(ownUnitId);
        const factor =
          ownUnit?.factor ??
          (spec.kind === 'volume'
            ? scales.volume
            : spec.kind === 'area'
              ? scales.area
              : spec.kind === 'length'
                ? scales.length
                : 1);
        result.push({ setName, name, kind: spec.kind, value: raw * factor });
      }
    }
    return result;
  };

  // ---- Elements ----
  const elements: ExtractedElement[] = [];
  let skippedWithoutGeometry = 0;

  for (const typeCode of api.GetIfcEntityList(modelID)) {
    if (!api.IsIfcElement(typeCode)) continue;
    const ifcClass = api.GetNameFromTypeCode(typeCode);
    if (EXCLUDED_CLASSES.has(ifcClass.toUpperCase())) continue;

    for (const id of idsOfType(typeCode)) {
      const element = line(id);
      // Only elements with their own geometry: what you see and click in the viewer.
      // This also avoids double counting aggregates (IfcCurtainWall vs its plates).
      if (ref(element['Representation']) === null) {
        skippedWithoutGeometry++;
        continue;
      }
      const globalId = str(element['GlobalId']);
      if (!globalId) continue;

      const typeId = typeOf.get(id);
      elements.push({
        globalId,
        ifcClass,
        name: str(element['Name']),
        typeName:
          (typeId !== undefined ? str(line(typeId)['Name']) : null) ?? str(element['ObjectType']),
        level: storeyName(id),
        ...pickQuantities(quantitiesOf(id)),
      });
    }
  }

  return { schema: api.GetModelSchema(modelID), scales, elements, skippedWithoutGeometry };
}

/** Convenience wrapper: opens the IFC bytes, extracts and always closes the model. */
export function extractElementsFromBytes(api: IfcApiLike, bytes: Uint8Array): ExtractionResult {
  const modelID = api.OpenModel(bytes);
  try {
    return extractElements(api, modelID);
  } finally {
    api.CloseModel(modelID);
  }
}
