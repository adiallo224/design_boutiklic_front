import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@boutiklic/shared'

import fr from './locales/fr.json'
import en from './locales/en.json'
import pt from './locales/pt.json'

/** Détection : langue déjà choisie (localStorage, clé partagée avec lib/language.ts) sinon
 *  langue du navigateur, sinon français — cf. plan multilingue fr/en/pt. */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en }, pt: { translation: pt } },
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'boutiklic_lang',
      caches: [],
    },
    interpolation: { escapeValue: false },
  })

export default i18n
