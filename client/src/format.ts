// Colombian formatting conventions in one place (es-CO: "1.234,5" and "$ 1.234.567").

const dateFormat = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' });
const numberFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });

export function formatDate(iso: string): string {
  return dateFormat.format(new Date(iso));
}

export function formatNumber(value: number): string {
  return numberFormat.format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
