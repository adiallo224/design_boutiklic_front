import type { Locale } from './locale'

/** Tags BCP 47 complets utilisés pour Intl — cf. plan i18n : portugais européen (pt-PT), pas pt-BR. */
const INTL_TAG: Record<Locale, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  pt: 'pt-PT',
}

export function toIntlTag(locale: Locale): string {
  return INTL_TAG[locale]
}

export function formatNumber(value: number, locale: Locale, options?: Intl.NumberFormatOptions): string {
  return value.toLocaleString(toIntlTag(locale), options)
}

export function formatDate(value: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString(toIntlTag(locale), options)
}

export function formatTime(value: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString(toIntlTag(locale), options ?? { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(value: Date | string, locale: Locale, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString(toIntlTag(locale), options)
}
