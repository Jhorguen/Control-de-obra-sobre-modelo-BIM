import type { QuantitySource, Unit } from '@bim/shared';
import { formatNumber } from './format';
import { t } from './i18n/core';

export function unitLabel(unit: Unit): string {
  return t(`unit.${unit}`);
}

export function sourceLabel(source: QuantitySource): string {
  return t(`source.${source}`);
}

/** "volumen × 90" — how an item turns element quantities into its own unit. */
export function quantityRule(source: QuantitySource, factor: number): string {
  const base = t(`sourceShort.${source}`);
  return factor === 1 ? base : `${base} × ${formatNumber(factor)}`;
}
