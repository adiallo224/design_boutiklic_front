import { isTargetedByPromotion } from '@boutiklic/shared'
import { resolvePrice } from './promotionPricing'
import type { PromotionResponse } from './promotionsApi'
import type { Product } from '../types'

const promo = (id: string, productIds: string[], categoryIds: string[]): PromotionResponse => ({
  id,
  name: id,
  type: 'PERCENTAGE',
  value: 10,
  currency: 'GNF',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-12-31T00:00:00Z',
  active: true,
  productIds,
  categoryIds,
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
})

const product = (id: string, categoryId?: string): Product => ({
  id,
  name: id,
  category: categoryId ?? 'Sans catégorie',
  categoryId,
  purchasePrice: 700,
  salePrice: 1000,
  currency: 'GNF',
  quantity: 5,
  alertThreshold: 1,
  lastRestockAt: null,
  isFavorite: false,
  isActive: true,
})

// Garde-fou : l'étiquette et la caisse mobile ne doivent JAMAIS diverger sur « cet article est-il en promo ? ».
describe('isTargetedByPromotion ≡ resolvePrice (caisse mobile)', () => {
  it('sur toutes les combinaisons produit / catégorie / promotions', () => {
    const products = [product('p1'), product('p2', 'c1'), product('p3', 'c2'), product('p4', 'c1'), product('p5', 'c9')]
    const promotions = [promo('a', ['p1'], []), promo('b', [], ['c1']), promo('c', ['p3'], ['c9']), promo('d', [], [])]
    for (const p of products) {
      for (const subset of [[], [promotions[0]], [promotions[1]], [promotions[2]], [promotions[3]], promotions]) {
        const label = `${p.id} × [${subset.map((s) => s.id)}]`
        const viaLabels = subset.some((pr) => isTargetedByPromotion(pr, p))
        const viaCaisse = resolvePrice(p, subset).promotionId !== null
        expect({ label, viaLabels }).toEqual({ label, viaLabels: viaCaisse })
      }
    }
  })
})
