import { describe, expect, it } from 'vitest'
import { MAX_COPIES_PER_PRODUCT, isTargetedByPromotion, mergePreselection, promotedProductIds } from '@boutiklic/shared/src/labels/labelModel'
import { resolvePrice } from '../promotionPricing'
import type { PromotionResponse } from '../promotionsApi'
import type { Product } from '../../types'

describe('mergePreselection — lignes d’arrivage', () => {
  it('somme les quantités d’un même article et garde l’ordre de première apparition', () => {
    expect(
      mergePreselection([
        { productId: 'a', copies: 3 },
        { productId: 'b', copies: 5 },
        { productId: 'a', copies: 4 },
      ]),
    ).toEqual([
      { productId: 'a', copies: 7 },
      { productId: 'b', copies: 5 },
    ])
  })

  it('borne à 1..999', () => {
    expect(mergePreselection([{ productId: 'a', copies: 800 }, { productId: 'a', copies: 800 }])).toEqual([{ productId: 'a', copies: MAX_COPIES_PER_PRODUCT }])
    expect(mergePreselection([{ productId: 'a', copies: 0 }])).toEqual([{ productId: 'a', copies: 1 }])
    expect(mergePreselection([{ productId: 'a', copies: -5 }])).toEqual([{ productId: 'a', copies: 1 }])
    expect(mergePreselection([{ productId: 'a', copies: Number.NaN }])).toEqual([{ productId: 'a', copies: 1 }])
    expect(mergePreselection([{ productId: 'a', copies: 2.9 }])).toEqual([{ productId: 'a', copies: 2 }])
  })

  it('liste vide → vide', () => {
    expect(mergePreselection([])).toEqual([])
  })
})

const promo = (overrides: Partial<PromotionResponse> = {}): PromotionResponse => ({
  id: 'promo-1',
  name: 'Soldes',
  type: 'PERCENTAGE',
  value: 10,
  currency: 'GNF',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-12-31T00:00:00Z',
  active: true,
  productIds: [],
  categoryIds: [],
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

const product = (id: string, categoryId?: string): Product => ({
  id,
  name: `Article ${id}`,
  category: categoryId ? `Cat ${categoryId}` : 'Sans catégorie',
  categoryId,
  purchasePrice: 700,
  salePrice: 1000,
  currency: 'GNF',
  imageUrls: [],
  quantity: 5,
  alertThreshold: 1,
  isFavorite: false,
  isActive: true,
})

describe('isTargetedByPromotion', () => {
  it('produit ciblé directement', () => {
    expect(isTargetedByPromotion(promo({ productIds: ['p1'] }), product('p1'))).toBe(true)
    expect(isTargetedByPromotion(promo({ productIds: ['p1'] }), product('p2'))).toBe(false)
  })

  it('catégorie exacte de l’article (pas de descendance)', () => {
    expect(isTargetedByPromotion(promo({ categoryIds: ['c1'] }), product('p1', 'c1'))).toBe(true)
    expect(isTargetedByPromotion(promo({ categoryIds: ['c1'] }), product('p1', 'c1-enfant'))).toBe(false)
    expect(isTargetedByPromotion(promo({ categoryIds: ['c1'] }), product('p1'))).toBe(false)
  })

  it('promotion sans cible → n’applique rien', () => {
    expect(isTargetedByPromotion(promo(), product('p1', 'c1'))).toBe(false)
  })

  // Garde-fou principal : l'étiquette et la caisse ne doivent JAMAIS diverger sur « cet article est-il en promo ? ».
  it('équivalent à resolvePrice de la caisse sur toutes les combinaisons', () => {
    const products = [product('p1'), product('p2', 'c1'), product('p3', 'c2'), product('p4', 'c1'), product('p5', 'c9')]
    const promotions = [
      promo({ id: 'a', productIds: ['p1'] }),
      promo({ id: 'b', categoryIds: ['c1'] }),
      promo({ id: 'c', productIds: ['p3'], categoryIds: ['c9'] }),
      promo({ id: 'd' }),
    ]
    for (const p of products) {
      for (const subset of [[], [promotions[0]], [promotions[1]], [promotions[2]], [promotions[3]], promotions]) {
        const viaCaisse = resolvePrice(p, subset).promotionId !== null
        const viaLabels = subset.some((pr) => isTargetedByPromotion(pr, p))
        expect(viaLabels, `${p.id} × [${subset.map((s) => s.id)}]`).toBe(viaCaisse)
      }
    }
  })
})

describe('promotedProductIds', () => {
  const products = [product('p1'), product('p2', 'c1'), product('p3', 'c2')]

  it('ids des articles visés, ordre du catalogue', () => {
    expect(promotedProductIds([promo({ productIds: ['p3'] }), promo({ categoryIds: ['c1'] })], products)).toEqual(['p2', 'p3'])
  })

  it('aucune promotion → aucun article', () => {
    expect(promotedProductIds([], products)).toEqual([])
  })

  it('un article visé par deux promotions n’apparaît qu’une fois', () => {
    expect(promotedProductIds([promo({ productIds: ['p1'] }), promo({ productIds: ['p1'] })], products)).toEqual(['p1'])
  })
})
