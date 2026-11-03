import i18n from '../i18n'
import { toIntlTag, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'

function currentIntlLocale(): string {
  return toIntlTag(isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE)
}

export function formatDate(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleDateString(currentIntlLocale(), options)
}

export function formatTime(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleTimeString(currentIntlLocale(), options ?? { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(value: Date | string, options: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  return date.toLocaleString(currentIntlLocale(), options)
}

export function formatRelativeDay(value: Date | string, fallbackOptions?: Intl.DateTimeFormatOptions): string {
  const date = typeof value === 'string' ? new Date(value) : value
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return i18n.t('common.today')
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return i18n.t('common.yesterday')
  return formatDate(date, fallbackOptions)
}
