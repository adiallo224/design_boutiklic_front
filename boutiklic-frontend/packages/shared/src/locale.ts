export type Locale = 'fr' | 'en' | 'pt'

export const SUPPORTED_LOCALES: Locale[] = ['fr', 'en', 'pt']

export const DEFAULT_LOCALE: Locale = 'fr'

export function isSupportedLocale(value: string | null | undefined): value is Locale {
  return !!value && (SUPPORTED_LOCALES as string[]).includes(value)
}
