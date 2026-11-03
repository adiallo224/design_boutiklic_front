import { describe, expect, it } from 'vitest'
import { resolvePrice } from './promotionPricing'
import type { Product } from '../types'
import type { PromotionResponse } from './promotionsApi'

/** study/audits.md (ÉLEVÉ #9) : la logique de prix en caisse n'avait aucun test — une régression
 *  ici n'est aujourd'hui rattrapée que par la QA visuelle. Couvre le ciblage produit/catégorie, le
 *  choix de la promotion la plus avantageuse, l'arrondi et le plancher à 0. */

function product(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    name: 'Sac de riz 25kg',
    category: 'Alimentation',
    categoryId: 'cat-1',
    purchasePrice: 80000,
    salePrice: 100000,
    currency: 'GNF',
    imageUrls: [],
    quantity: 10,
    alertThreshold: 2,
    isFavorite: false,
    isActive: true,
    ...overrides,
  }
}

function promotion(overrides: Partial<PromotionResponse> = {}): PromotionResponse {
  return {
    id: 'promo-1',
    name: 'Promo riz',
    type: 'PERCENTAGE',
    value: 10,
    currency: 'GNF',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    active: true,
    productIds: [],
    categoryIds: [],
    createdBy: 'user-1',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('resolvePrice', () => {
  it('returns the catalog price unchanged when no promotion applies', () => {
    const result = resolvePrice(product(), [])

    expect(result).toEqual({ unitPrice: 100000, catalogPrice: null, promotionId: null })
  })

  it('applies a percentage discount targeted directly by productId', () => {
    const promo = promotion({ type: 'PERCENTAGE', value: 10, productIds: ['product-1'] })

    const result = resolvePrice(product(), [promo])

    expect(result).toEqual({ unitPrice: 90000, catalogPrice: 100000, promotionId: 'promo-1' })
  })

  it('applies a fixed amount discount targeted by categoryId', () => {
    const promo = promotion({ type: 'AMOUNT', value: 15000, categoryIds: ['cat-1'] })

    const result = resolvePrice(product(), [promo])

    expect(result).toEqual({ unitPrice: 85000, catalogPrice: 100000, promotionId: 'promo-1' })
  })

  it('ignores a category promotion when the product has no categoryId', () => {
    const promo = promotion({ type: 'AMOUNT', value: 15000, categoryIds: ['cat-1'] })

    const result = resolvePrice(product({ categoryId: undefined }), [promo])

    expect(result).toEqual({ unitPrice: 100000, catalogPrice: null, promotionId: null })
  })

  it('ignores a promotion that targets neither this product nor this category', () => {
    const promo = promotion({ productIds: ['other-product'], categoryIds: ['other-cat'] })

    const result = resolvePrice(product(), [promo])

    expect(result).toEqual({ unitPrice: 100000, catalogPrice: null, promotionId: null })
  })

  it('picks the most advantageous promotion for the customer among several candidates', () => {
    const small = promotion({ id: 'promo-small', type: 'PERCENTAGE', value: 5, productIds: ['product-1'] })
    const big = promotion({ id: 'promo-big', type: 'PERCENTAGE', value: 20, productIds: ['product-1'] })

    const result = resolvePrice(product(), [small, big])

    expect(result).toEqual({ unitPrice: 80000, catalogPrice: 100000, promotionId: 'promo-big' })
  })

  it('compares a percentage and an amount promotion by their actual discount amount', () => {
    // 12% de 100000 = 12000, moins avantageux que 15000 fixe
    const percentage = promotion({ id: 'promo-pct', type: 'PERCENTAGE', value: 12, productIds: ['product-1'] })
    const amount = promotion({ id: 'promo-amt', type: 'AMOUNT', value: 15000, productIds: ['product-1'] })

    const result = resolvePrice(product(), [percentage, amount])

    expect(result.promotionId).toBe('promo-amt')
    expect(result.unitPrice).toBe(85000)
  })

  it('rounds a fractional discounted price instead of truncating', () => {
    const promo = promotion({ type: 'PERCENTAGE', value: 15, productIds: ['product-1'] })

    // 999 * 0.15 = 149.85 -> remise 149.85 -> 999 - 149.85 = 849.15 -> arrondi à 849
    const result = resolvePrice(product({ salePrice: 999 }), [promo])

    expect(result.unitPrice).toBe(849)
  })

  it('never returns a negative price when the discount exceeds the catalog price', () => {
    const promo = promotion({ type: 'AMOUNT', value: 500000, productIds: ['product-1'] })

    const result = resolvePrice(product({ salePrice: 100000 }), [promo])

    expect(result.unitPrice).toBe(0)
    expect(result.catalogPrice).toBe(100000)
  })
})

/** Étude prix décimaux, phase 5bis : le prix promo est arrondi à la précision des prix de vente de la BOUTIQUE. */
describe('resolvePrice — précision des prix de vente de la boutique', () => {
  const salePrice333 = product({ salePrice: 333.33 })
  const tenPercent = promotion({ productIds: ['product-1'], value: 10 })

  it('par défaut (0 décimale) : prix promo entier, comme avant', () => {
    // 333,33 - 10 % = 299,997 -> 300
    expect(resolvePrice(salePrice333, [tenPercent]).unitPrice).toBe(300)
  })

  it('à 2 décimales : le prix promo garde ses centimes (299,997 -> 300,00), sans dérive', () => {
    expect(resolvePrice(salePrice333, [tenPercent], 2).unitPrice).toBe(300)
    expect(resolvePrice(product({ salePrice: 333.33 }), [promotion({ productIds: ['product-1'], value: 15 })], 2).unitPrice).toBe(283.33)
  })

  it('à 1 décimale : arrondi à un chiffre', () => {
    // 333,33 - 15 % = 283,3305 -> 283,3
    expect(resolvePrice(salePrice333, [promotion({ productIds: ['product-1'], value: 15 })], 1).unitPrice).toBe(283.3)
  })

  it('le prix catalogue (avant promotion) garde ses décimales tel quel', () => {
    expect(resolvePrice(salePrice333, [tenPercent], 2).catalogPrice).toBe(333.33)
  })

  it('sans promotion : le prix catalogue est renvoyé tel quel, décimales comprises', () => {
    expect(resolvePrice(salePrice333, [], 2)).toEqual({ unitPrice: 333.33, catalogPrice: null, promotionId: null })
  })

  it('le plancher à 0 tient quelle que soit la précision', () => {
    expect(resolvePrice(salePrice333, [promotion({ productIds: ['product-1'], type: 'AMOUNT', value: 999 })], 2).unitPrice).toBe(0)
  })
})
