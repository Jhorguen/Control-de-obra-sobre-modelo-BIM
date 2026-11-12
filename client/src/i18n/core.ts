// Interface language: a tiny store (no library) with Spanish and English dictionaries.
// Components read it through useI18n(); plain functions (formatting, error messages,
// toasts) call t() and locale() directly.
import { en } from './messages.en';
import { es, type MessageKey } from './messages.es';

export type Language = 'es' | 'en';
export const LANGUAGES: readonly Language[] = ['es', 'en'];

const DICTIONARIES: Record<Language, Record<MessageKey, string>> = { es, en };
/** Number and date conventions per language. Money stays in Colombian pesos in both. */
const LOCALES: Record<Language, string> = { es: 'es-CO', en: 'en-US' };
const STORAGE_KEY = 'language';

export type Params = Record<string, string | number>;
/** Keys that come in a `_one` / `_other` pair, named without the suffix. */
export type PluralKey = {
  [K in MessageKey]: K extends `${infer Base}_one` ? Base : never;
}[MessageKey];

function detectLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'es' || saved === 'en') return saved;
  } catch {
    // Storage can be blocked (private mode, sandboxed previews): fall through.
  }
  const preferred = typeof navigator === 'undefined' ? 'es' : navigator.language;
  return preferred.toLowerCase().startsWith('en') ? 'en' : 'es';
}

let current: Language = detectLanguage();
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Not persisted; the choice still applies until the page is reloaded.
  }
  syncDocument();
  for (const listener of listeners) listener();
}

export function subscribeLanguage(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** BCP 47 locale for Intl formatting in the current language. */
export function locale(): string {
  return LOCALES[current];
}

function interpolate(template: string, params?: Params): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in params ? String(params[name]) : match,
  );
}

export function translate(language: Language, key: MessageKey, params?: Params): string {
  return interpolate(DICTIONARIES[language][key], params);
}

/** Text in the current language; `{name}` placeholders are filled from `params`. */
export function t(key: MessageKey, params?: Params): string {
  return translate(current, key, params);
}

/** Picks the `_one` or `_other` form by `count` (also available as `{count}`). */
export function translatePlural(
  language: Language,
  key: PluralKey,
  count: number,
  params?: Params,
): string {
  const form: MessageKey = count === 1 ? `${key}_one` : `${key}_other`;
  return translate(language, form, { count, ...params });
}

export function tp(key: PluralKey, count: number, params?: Params): string {
  return translatePlural(current, key, count, params);
}

/** For keys built at runtime (e.g. IFC class names): true when the dictionary has it. */
export function isMessageKey(key: string): key is MessageKey {
  return key in es;
}

/** Keeps <html lang> and the tab title in the current language. */
export function syncDocument(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = current;
  document.title = t('app.title');
}
