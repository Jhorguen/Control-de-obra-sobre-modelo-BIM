// Number, money and date formatting in one place, following the interface language:
// es-CO ("1.234,5", "$ 1.234.567") or en-US ("1,234.5", "COP 1,234,567"). Money is always
// in Colombian pesos.
import { locale } from './i18n/core';

const formatters = new Map<string, Intl.NumberFormat | Intl.DateTimeFormat>();

function numberFormat(name: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale()}|${name}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.NumberFormat(locale(), options);
    formatters.set(key, format);
  }
  return format as Intl.NumberFormat;
}

function dateFormat(name: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = `${locale()}|${name}`;
  let format = formatters.get(key);
  if (!format) {
    format = new Intl.DateTimeFormat(locale(), options);
    formatters.set(key, format);
  }
  return format as Intl.DateTimeFormat;
}

const mediumDate = () => dateFormat('date', { dateStyle: 'medium' });

/** YYYY-MM-DD as a local date, without time zone shifts. */
function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function formatDate(iso: string): string {
  return mediumDate().format(new Date(iso));
}

export function formatNumber(value: number): string {
  return numberFormat('number', { maximumFractionDigits: 3 }).format(value);
}

/** Quantities in a takeoff are read with two decimals (e.g. 12,35 m³). */
export function formatQuantity(value: number): string {
  return numberFormat('quantity', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );
}

/** Colombian pesos without cents, as budgets are usually presented: $ 1.234.567. */
export function formatCOP(value: number): string {
  return numberFormat('cop', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
  }).format(value);
}

/** Short amounts for chart axes: $ 99,4 M. */
export function formatCOPCompact(value: number): string {
  return numberFormat('copCompact', {
    style: 'currency',
    currency: 'COP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

/** 0.256 -> "25,6 %" */
export function formatPercent(ratio: number): string {
  return numberFormat('percent', { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
}

/** YYYY-MM-DD -> "10 mar 2026" / "Mar 10, 2026". */
export function formatIsoDate(iso: string): string {
  return mediumDate().format(isoToLocalDate(iso));
}

/** YYYY-MM-DD -> "10/03" / "03/10", for crowded chart axes (the tooltip has the full date). */
export function formatShortDate(iso: string): string {
  return dateFormat('short', { day: '2-digit', month: '2-digit' }).format(isoToLocalDate(iso));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatNumber(Math.round(bytes / 1024))} KB`;
  return `${numberFormat('megabytes', { maximumFractionDigits: 1 }).format(bytes / 1024 / 1024)} MB`;
}
