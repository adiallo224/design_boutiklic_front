import { describe, expect, it } from 'vitest'
import { MESSAGES, pickLocale, statusLabel, translate } from '../lib/i18n'

describe('traductions', () => {
  it('les trois langues ont exactement les mêmes clés', () => {
    const fr = Object.keys(MESSAGES.fr).sort()
    expect(Object.keys(MESSAGES.en).sort()).toEqual(fr)
    expect(Object.keys(MESSAGES.pt).sort()).toEqual(fr)
  })
  it('aucun texte vide', () => {
    for (const locale of ['fr', 'en', 'pt'] as const) for (const [key, value] of Object.entries(MESSAGES[locale])) expect(value.trim(), locale + '.' + key).not.toBe('')
  })
  it('une langue inconnue retombe sur le français', () => {
    expect(pickLocale('de')).toBe('fr')
    expect(pickLocale(null)).toBe('fr')
    expect(pickLocale('pt')).toBe('pt')
  })
  it('traduit les états de l\'API, et garde un état inconnu tel quel', () => {
    expect(statusLabel('fr', 'orderStatus', 'CONFIRMED')).toBe('Confirmée')
    expect(statusLabel('en', 'fulfillment', 'OUT_FOR_DELIVERY')).toBe('Out for delivery')
    expect(statusLabel('pt', 'payment', 'PAID')).toBe('Paga')
    expect(statusLabel('fr', 'orderStatus', 'NOUVEL_ETAT')).toBe('NOUVEL_ETAT')
    expect(translate('en', 'cart')).toBe('Cart')
  })
})
