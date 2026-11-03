import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import * as Localization from 'expo-localization'
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale } from '@boutiklic/shared'

import fr from './locales/fr.json'
import en from './locales/en.json'
import pt from './locales/pt.json'

/** Détection synchrone (langue système) au premier rendu — la préférence persistée en
 *  AsyncStorage (lib/language.ts, async) est reprise ensuite par RootLayout via changeLanguage(),
 *  cf. plan multilingue fr/en/pt. */
function detectDeviceLocale(): string {
  const deviceLocale = Localization.getLocales()[0]?.languageCode
  return isSupportedLocale(deviceLocale) ? deviceLocale : DEFAULT_LOCALE
}

i18n
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en }, pt: { translation: pt } },
    lng: detectDeviceLocale(),
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: SUPPORTED_LOCALES,
    interpolation: { escapeValue: false },
  })

export default i18n
