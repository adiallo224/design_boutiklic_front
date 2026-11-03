import { formatMoney, type Locale } from '@boutiklic/shared'

/** Montant TTC affiché à la précision de sa devise (0 décimale en GNF / FCFA). */
export const money = (amount: number, currency: string, locale: Locale): string => formatMoney(amount, currency, locale)

/** Chiffres seuls d'un numéro, pour un lien wa.me. */
export const digitsOnly = (phone: string): string => phone.replace(/\D/g, '')
