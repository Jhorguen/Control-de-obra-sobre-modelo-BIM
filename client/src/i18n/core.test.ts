import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../api/http';
import { formatCOP, formatPercent } from '../format';
import { errorMessage } from '../hooks/useAsync';
import { ifcClassLabel } from '../ifcClasses';
import { en } from './messages.en';
import { es } from './messages.es';
import { getLanguage, setLanguage, t, tp } from './core';

beforeEach(() => setLanguage('es'));

describe('dictionaries', () => {
  it('have the same keys and no empty texts', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
    for (const text of [...Object.values(es), ...Object.values(en)]) expect(text).not.toBe('');
  });

  it('use the same placeholders in both languages', () => {
    const placeholders = (text: string) => (text.match(/\{\w+\}/g) ?? []).sort();
    for (const key of Object.keys(es) as (keyof typeof es)[]) {
      expect(placeholders(en[key]), key).toEqual(placeholders(es[key]));
    }
  });
});

describe('t and tp', () => {
  it('fill placeholders and switch language', () => {
    expect(t('projects.created', { date: '1 nov 2026' })).toBe('Creado 1 nov 2026');
    setLanguage('en');
    expect(getLanguage()).toBe('en');
    expect(t('projects.created', { date: 'Nov 1, 2026' })).toBe('Created Nov 1, 2026');
  });

  it('pick the singular or plural form by count', () => {
    expect(tp('common.selected', 1)).toBe('1 elemento seleccionado');
    expect(tp('common.selected', 4)).toBe('4 elementos seleccionados');
    setLanguage('en');
    expect(tp('common.selected', 0)).toBe('0 elements selected');
  });

  it('name IFC classes and keep unknown ones as they are', () => {
    expect(ifcClassLabel('IfcSlab')).toBe('Losas');
    expect(ifcClassLabel('IfcSomethingNew')).toBe('IfcSomethingNew');
    setLanguage('en');
    expect(ifcClassLabel('IfcSlab')).toBe('Slabs');
  });
});

describe('formatting and errors follow the language', () => {
  it('formats money in pesos with each locale', () => {
    expect(formatCOP(1234567)).toMatch(/1\.234\.567/);
    expect(formatPercent(0.378)).toMatch(/37,8/);
    setLanguage('en');
    expect(formatCOP(1234567)).toMatch(/COP\s?1,234,567/);
    expect(formatPercent(0.378)).toBe('37.8%');
  });

  it('shows the server message in Spanish and translates the code in English', () => {
    const error = new ApiError(409, 'DUPLICATE_CODE', 'Ya existe un ítem con el código "2.1".');
    expect(errorMessage(error)).toBe('Ya existe un ítem con el código "2.1".');
    setLanguage('en');
    expect(errorMessage(error)).toBe('An item with that code already exists.');
    expect(errorMessage(new ApiError(418, 'SOMETHING_NEW', 'Mensaje'))).toBe('Mensaje');
  });
});
