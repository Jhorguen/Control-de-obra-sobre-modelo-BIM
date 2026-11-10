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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
