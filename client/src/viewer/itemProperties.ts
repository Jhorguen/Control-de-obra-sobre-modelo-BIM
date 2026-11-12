import type { ItemAttribute, ItemData } from '@thatopen/fragments';
import { formatNumber } from '../format';
import { t } from '../i18n/core';

// Turns the generic item graph returned by Fragments into what the properties panel shows.
// Pure functions: no viewer needed, easy to test.

export interface PropertyEntry {
  name: string;
  value: string;
}

export interface PropertyGroup {
  name: string;
  /** IfcPropertySet (descriptive data) or IfcElementQuantity (measured quantities). */
  kind: 'properties' | 'quantities';
  /** Defined by the IFC standard (Pset_*, Qto_*, BaseQuantities) rather than by the authoring tool. */
  standard: boolean;
  entries: PropertyEntry[];
}

export function isStandardSetName(name: string): boolean {
  return /^(Pset_|Qto_)/.test(name) || name === 'BaseQuantities';
}

/** Quantities first (what this app is about), standard sets before vendor-specific ones. */
function compareGroups(a: PropertyGroup, b: PropertyGroup): number {
  if (a.kind !== b.kind) return a.kind === 'quantities' ? -1 : 1;
  if (a.standard !== b.standard) return a.standard ? -1 : 1;
  return a.name.localeCompare(b.name);
}

export interface ElementProperties {
  localId: number;
  globalId: string | null;
  ifcClass: string | null;
  name: string | null;
  typeName: string | null;
  level: string | null;
  groups: PropertyGroup[];
}

function isAttribute(value: ItemAttribute | ItemData[] | undefined): value is ItemAttribute {
  return value !== undefined && !Array.isArray(value);
}

function attr(item: ItemData, key: string): unknown {
  const value = item[key];
  return isAttribute(value) ? value.value : undefined;
}

function text(item: ItemData, key: string): string | null {
  const value = attr(item, key);
  return value === undefined || value === null || value === '' ? null : String(value);
}

function related(item: ItemData, key: string): ItemData[] {
  const value = item[key];
  return Array.isArray(value) ? value : [];
}

export function formatPropertyValue(value: unknown): string {
  if (typeof value === 'boolean') return value ? t('common.yes') : t('common.no');
  if (typeof value === 'number') return formatNumber(value);
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

/**
 * Single values store their data in an attribute ending in "Value": NominalValue for
 * properties, VolumeValue/AreaValue/LengthValue/CountValue... for quantities.
 */
function entryValue(entry: ItemData): unknown {
  for (const key of Object.keys(entry)) {
    if (key.endsWith('Value') && isAttribute(entry[key])) return attr(entry, key);
  }
  return undefined;
}

function toGroup(definition: ItemData): PropertyGroup | null {
  const category = text(definition, '_category')?.toUpperCase();
  const name = text(definition, 'Name') ?? t('common.unnamed');
  const standard = isStandardSetName(name);
  if (category === 'IFCPROPERTYSET') {
    return {
      name,
      kind: 'properties',
      standard,
      entries: related(definition, 'HasProperties').map((p) => ({
        name: text(p, 'Name') ?? '—',
        value: formatPropertyValue(entryValue(p)),
      })),
    };
  }
  if (category === 'IFCELEMENTQUANTITY') {
    return {
      name,
      kind: 'quantities',
      standard,
      entries: related(definition, 'Quantities').map((q) => ({
        name: text(q, 'Name') ?? '—',
        value: formatPropertyValue(entryValue(q)),
      })),
    };
  }
  return null;
}

export function toElementProperties(localId: number, item: ItemData): ElementProperties {
  // Fragments exposes IfcRelDefinesByType through IsDefinedBy as well: the type object
  // (IFCWALLTYPE, IFCDOORTYPE...) sits next to the property sets.
  const type = related(item, 'IsDefinedBy').find((definition) =>
    /TYPE$/.test(text(definition, '_category')?.toUpperCase() ?? ''),
  );
  const container = related(item, 'ContainedInStructure')[0];
  const groups = related(item, 'IsDefinedBy')
    .map(toGroup)
    .filter((group): group is PropertyGroup => group !== null)
    .sort(compareGroups);

  return {
    localId,
    globalId: text(item, '_guid') ?? text(item, 'GlobalId'),
    ifcClass: text(item, '_category'),
    name: text(item, 'Name'),
    typeName: (type && text(type, 'Name')) ?? text(item, 'ObjectType'),
    level: container ? text(container, 'Name') : null,
    groups,
  };
}
