import { hasPaymentMethod, paymentPortions, sumByMethod } from './salePayments'
import type { SaleHistoryItemResponse } from './salesApi'

/** Miroir du test web (boutiklic-frontend/src/lib/salePayments.test.ts) — les deux helpers sont identiques. */

function sale(overrides: Partial<SaleHistoryItemResponse>): Pick<SaleHistoryItemResponse, 'paymentMethod' | 'totalAmount' | 'payments'> {
  return { paymentMethod: 'CASH', totalAmount: 0, payments: [], ...overrides }
}

const mixed = sale({
  paymentMethod: 'MIXED',
  totalAmount: 150000,
  payments: [
    { method: 'CASH', amount: 100000 },
    { method: 'DEBT', amount: 50000 },
  ],
})

describe('paymentPortions', () => {
  it('utilise les tranches quand le serveur les fournit', () => {
    expect(paymentPortions(mixed)).toEqual([
      { method: 'CASH', amount: 100000 },
      { method: 'DEBT', amount: 50000 },
    ])
  })

  it('se replie sur le montant total pour un mode unique sans détail (ancienne réponse)', () => {
    expect(paymentPortions(sale({ paymentMethod: 'MOBILE_MONEY_WAVE', totalAmount: 20000, payments: undefined as never }))).toEqual([
      { method: 'MOBILE_MONEY_WAVE', amount: 20000 },
    ])
  })

  it('n\'invente aucune répartition pour une vente MIXED sans détail', () => {
    expect(paymentPortions(sale({ paymentMethod: 'MIXED', totalAmount: 150000, payments: [] }))).toEqual([])
  })
})

describe('hasPaymentMethod', () => {
  it('reconnaît un mode présent dans une seule tranche d\'une vente mixte', () => {
    expect(hasPaymentMethod(mixed, 'CASH')).toBe(true)
    expect(hasPaymentMethod(mixed, 'DEBT')).toBe(true)
    expect(hasPaymentMethod(mixed, 'MOBILE_MONEY_WAVE')).toBe(false)
  })
})

describe('sumByMethod', () => {
  it('compte la portion espèces et la portion dette d\'une vente mixte, sans les confondre', () => {
    const sales = [mixed, sale({ paymentMethod: 'CASH', totalAmount: 30000, payments: [{ method: 'CASH', amount: 30000 }] })]

    expect(sumByMethod(sales, 'CASH')).toBe(130000)
    expect(sumByMethod(sales, 'DEBT')).toBe(50000)
    expect(sumByMethod(sales, 'MOBILE_MONEY_ORANGE')).toBe(0)
  })

  it('la somme des modes égale le total des ventes', () => {
    const wave = sale({ paymentMethod: 'MOBILE_MONEY_WAVE', totalAmount: 20000, payments: [{ method: 'MOBILE_MONEY_WAVE', amount: 20000 }] })
    const sales = [mixed, wave]
    const methods = ['CASH', 'MOBILE_MONEY_ORANGE', 'MOBILE_MONEY_WAVE', 'DEBT'] as const

    expect(methods.reduce((s, m) => s + sumByMethod(sales, m), 0)).toBe(170000)
  })
})
