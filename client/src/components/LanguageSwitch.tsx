import { LANGUAGES } from '../i18n/core';
import { useI18n } from '../i18n/useI18n';

/** ES | EN toggle in the app bar; the choice is remembered on this device. */
export function LanguageSwitch() {
  const { language, setLanguage, t } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label={t('app.language')}>
      {LANGUAGES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={language === option}
          onClick={() => setLanguage(option)}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
