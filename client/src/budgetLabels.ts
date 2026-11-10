import type { QuantitySource, Unit } from '@bim/shared';

export const UNIT_LABELS: Record<Unit, string> = {
  M3: 'm³',
  M2: 'm²',
  M: 'm',
  KG: 'kg',
  UN: 'un',
};

export const SOURCE_LABELS: Record<QuantitySource, string> = {
  VOLUME: 'Volumen (m³)',
  AREA: 'Área (m²)',
  LENGTH: 'Longitud (m)',
  COUNT: 'Conteo (1 por elemento)',
};

const SHORT_SOURCE: Record<QuantitySource, string> = {
  VOLUME: 'volumen',
  AREA: 'área',
  LENGTH: 'longitud',
  COUNT: '1 por elemento',
};

/** "volumen × 90" — how an item turns element quantities into its own unit. */
export function quantityRule(source: QuantitySource, factor: number): string {
  const base = SHORT_SOURCE[source];
  return factor === 1 ? base : `${base} × ${new Intl.NumberFormat('es-CO').format(factor)}`;
}
