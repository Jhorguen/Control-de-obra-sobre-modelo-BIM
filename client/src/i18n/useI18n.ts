import { useMemo, useSyncExternalStore } from 'react';
import type { MessageKey } from './messages.es';
import {
  getLanguage,
  setLanguage,
  subscribeLanguage,
  translate,
  translatePlural,
  type Params,
  type PluralKey,
} from './core';

/**
 * The current language and translators bound to it. Components that call this re-render
 * when the language changes; the translators change identity with it, so nothing that
 * memoizes on them keeps a stale text.
 */
export function useI18n() {
  const language = useSyncExternalStore(subscribeLanguage, getLanguage, getLanguage);
  return useMemo(
    () => ({
      language,
      setLanguage,
      t: (key: MessageKey, params?: Params) => translate(language, key, params),
      tp: (key: PluralKey, count: number, params?: Params) =>
        translatePlural(language, key, count, params),
    }),
    [language],
  );
}
