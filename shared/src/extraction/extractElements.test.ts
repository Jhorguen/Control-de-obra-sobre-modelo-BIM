import { readFileSync } from 'node:fs';
import { IfcAPI } from 'web-ifc';
import { beforeAll, describe, expect, it } from 'vitest';
import { extractElementsFromBytes, type ExtractionResult } from './extractElements.js';

// Integration tests on real files. Expected values were read straight from the STEP text
// of each file (independently of web-ifc) to check the extraction against the IFC data.
const read = (relativePath: string) =>
  new Uint8Array(readFileSync(new URL(relativePath, import.meta.url)));

let fzkHaus: ExtractionResult;
let millimetreModel: ExtractionResult;

beforeAll(async () => {
  const api = new IfcAPI();
  await api.Init();
  fzkHaus = extractElementsFromBytes(api, read('../../../samples/AC20-FZK-Haus.ifc'));
  millimetreModel = extractElementsFromBytes(api, read('./__fixtures__/Building-Architecture.ifc'));
});

const byGuid = (result: ExtractionResult, guid: string) =>
  result.elements.find((e) => e.globalId === guid);

describe('AC20-FZK-Haus.ifc (metres, BaseQuantities)', () => {
  it('extracts every physical element once and nothing else', () => {
    const counts: Record<string, number> = {};
    for (const e of fzkHaus.elements) counts[e.ifcClass] = (counts[e.ifcClass] ?? 0) + 1;
    expect(counts).toEqual({
      IfcWallStandardCase: 13,
      IfcSlab: 4,
      IfcBeam: 4,
      IfcMember: 42,
      IfcDoor: 5,
      IfcWindow: 11,
      IfcStair: 1,
      IfcRailing: 2,
    });
    // No openings, spaces or storeys, and no duplicated GlobalIds.
    expect(new Set(fzkHaus.elements.map((e) => e.globalId)).size).toBe(fzkHaus.elements.length);
  });

  it('matches the IFC quantities of a wall, a door and a slab', () => {
    expect(byGuid(fzkHaus, '2XPyKWY018sA1ygZKgQPtU')).toMatchObject({
      ifcClass: 'IfcWallStandardCase',
      name: 'Wand-Int-ERDG-4',
      level: 'Erdgeschoss',
      volume: 2.49624,
      area: 10.425,
      length: 4.17,
    });
    expect(byGuid(fzkHaus, '1Oms875aH3Wg$9l65H2ZGw')).toMatchObject({
      ifcClass: 'IfcDoor',
      name: 'Innentuer-1',
      volume: 0.085569,
      area: 1.77885,
      length: null,
    });
    expect(byGuid(fzkHaus, '1pPHnf7cXCpPsNEnQf8_6B')).toMatchObject({
      ifcClass: 'IfcSlab',
      name: 'Bodenplatte',
      volume: 24,
      area: 120,
    });
  });

  it('assigns each element to its storey', () => {
    const levels = new Set(fzkHaus.elements.map((e) => e.level));
    expect(levels).toEqual(new Set(['Erdgeschoss', 'Dachgeschoss']));
  });

  it('leaves quantities as null when the model does not provide them', () => {
    const members = fzkHaus.elements.filter((e) => e.ifcClass === 'IfcMember');
    expect(members.every((m) => m.volume === null && m.area === null)).toBe(true);
  });
});

describe('Building-Architecture.ifc (millimetres, Qto_ sets)', () => {
  it('detects the millimetre length unit', () => {
    expect(millimetreModel.scales).toEqual({ length: 0.001, area: 1, volume: 1 });
  });

  it('converts lengths to metres and keeps m² and m³ as declared', () => {
    // The file stores Length = 1800 (mm), NetSideArea = 6.3463 m², NetVolume = 1.2693 m³.
    const wall = byGuid(millimetreModel, '1AQAupaRP1txwK1AGiN61V');
    expect(wall?.length).toBeCloseTo(1.8);
    expect(wall?.area).toBeCloseTo(6.346324676317878);
    expect(wall?.volume).toBeCloseTo(1.2692649352635803);
  });

  it('skips aggregates without their own geometry to avoid double counting', () => {
    expect(millimetreModel.skippedWithoutGeometry).toBeGreaterThan(0);
    expect(millimetreModel.elements.some((e) => e.ifcClass === 'IfcRoof')).toBe(false);
  });
});
