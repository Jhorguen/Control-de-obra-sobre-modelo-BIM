import type { ItemData } from '@thatopen/fragments';
import { describe, expect, it } from 'vitest';
import { formatPropertyValue, toElementProperties } from './itemProperties';

// Same shape Fragments returns from model.getItemsData() with IsDefinedBy and
// ContainedInStructure relations (verified against AC20-FZK-Haus.ifc).
const wall: ItemData = {
  _category: { value: 'IFCWALLSTANDARDCASE' },
  _guid: { value: '25fsbPyk15VvuXI$yNKenK' },
  Name: { value: 'Wand-Ext-ERDG-3', type: 'IFCLABEL' },
  ObjectType: { value: 'Muro exterior' },
  ContainedInStructure: [
    { _category: { value: 'IFCBUILDINGSTOREY' }, Name: { value: 'Erdgeschoss' } },
  ],
  IsDefinedBy: [
    // Fragments lists the type object (IfcRelDefinesByType) among the definitions.
    { _category: { value: 'IFCWALLTYPE' }, Name: { value: 'Leichtbeton 102890359 300' } },
    {
      _category: { value: 'IFCPROPERTYSET' },
      Name: { value: 'Pset_WallCommon' },
      HasProperties: [
        { Name: { value: 'IsExternal' }, NominalValue: { value: true, type: 'IFCBOOLEAN' } },
      ],
    },
    {
      _category: { value: 'IFCELEMENTQUANTITY' },
      Name: { value: 'ArchiCADQuantities' },
      Quantities: [{ Name: { value: 'Höhe' }, LengthValue: { value: 2.7 } }],
    },
    {
      _category: { value: 'IFCELEMENTQUANTITY' },
      Name: { value: 'BaseQuantities' },
      Quantities: [
        { Name: { value: 'NetVolume' }, VolumeValue: { value: 2.49624 } },
        { Name: { value: 'NetSideArea' }, AreaValue: { value: 10.425 } },
      ],
    },
  ],
};

describe('toElementProperties', () => {
  it('extracts the identity fields of the element', () => {
    const props = toElementProperties(42, wall);
    expect(props).toMatchObject({
      localId: 42,
      globalId: '25fsbPyk15VvuXI$yNKenK',
      ifcClass: 'IFCWALLSTANDARDCASE',
      name: 'Wand-Ext-ERDG-3',
      typeName: 'Leichtbeton 102890359 300',
      level: 'Erdgeschoss',
    });
  });

  it('lists quantity sets first, standard ones before vendor ones', () => {
    const names = toElementProperties(42, wall).groups.map((g) => g.name);
    expect(names).toEqual(['BaseQuantities', 'ArchiCADQuantities', 'Pset_WallCommon']);
  });

  it('reads values from NominalValue and from the *Value attribute of quantities', () => {
    const [base, , pset] = toElementProperties(42, wall).groups;
    expect(base?.entries).toEqual([
      { name: 'NetVolume', value: '2,496' },
      { name: 'NetSideArea', value: '10,425' },
    ]);
    expect(pset?.entries).toEqual([{ name: 'IsExternal', value: 'Sí' }]);
  });

  it('tolerates elements without relations', () => {
    const props = toElementProperties(1, { _category: { value: 'IFCDOOR' } });
    expect(props).toMatchObject({ name: null, level: null, typeName: null, groups: [] });
  });
});

describe('formatPropertyValue', () => {
  it('uses Colombian number format and Spanish booleans', () => {
    expect(formatPropertyValue(1234.5)).toBe('1.234,5');
    expect(formatPropertyValue(false)).toBe('No');
    expect(formatPropertyValue(null)).toBe('—');
  });
});
