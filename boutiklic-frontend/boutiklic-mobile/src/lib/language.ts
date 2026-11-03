import AsyncStorage from '@react-native-async-storage/async-storage'

export interface Language {
  code: string
  name: string
}

/** Limité aux langues réellement traduites (cf. src/i18n/locales/) — cf. plan multilingue fr/en/pt.
 *  `name` est l'endonyme (nom natif) de chaque langue : il ne change jamais avec la langue d'interface
 *  courante, contrairement au reste de l'UI — un locuteur portugais doit voir "Português" même si
 *  l'app est actuellement en français. */
export const LANGUAGES: Language[] = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
]

const KEY = 'boutiklic_lang'

/** Choisie à l'onboarding (Onboarding.tsx) ou depuis Réglages > Langue — 'fr' par défaut si jamais définie. */
export async function getLanguage(): Promise<Language> {
  const code = await AsyncStorage.getItem(KEY)
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]
}

export function setLanguage(code: string) {
  return AsyncStorage.setItem(KEY, code)
}
