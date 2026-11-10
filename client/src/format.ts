// Colombian formatting conventions in one place (es-CO: "1.234,5" and "$ 1.234.567").

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

const quantityFormat = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Quantities in a takeoff are read with two decimals (e.g. 12,35 m³). */
export function formatQuantity(value: number): string {
  return quantityFormat.format(value);
}

const copFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Colombian pesos without cents, as budgets are usually presented: $ 1.234.567. */
export function formatCOP(value: number): string {
  return copFormat.format(value);
}

const compactCopFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  notation: 'compact',
  maximumFractionDigits: 1,
});

/** Short amounts for chart axes: $ 99,4 M. */
export function formatCOPCompact(value: number): string {
  return compactCopFormat.format(value);
}

const percentFormat = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/** 0.256 -> "25,6 %" */
export function formatPercent(ratio: number): string {
  return percentFormat.format(ratio);
}

/** YYYY-MM-DD -> "10 mar 2026", without time zone shifts. */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return dateFormat.format(new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
