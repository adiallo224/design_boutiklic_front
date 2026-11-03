import { roundHalfUp } from '@boutiklic/shared'
import type { Product } from '../types'
import type { PromotionResponse } from './promotionsApi'

export interface ResolvedPrice {
  unitPrice: number
  /** Prix catalogue avant promotion — null si aucune promotion applicable. */
  catalogPrice: number | null
  promotionId: string | null
}

function discountAmount(promo: PromotionResponse, catalogPrice: number): number {
  return promo.type === 'PERCENTAGE' ? (catalogPrice * promo.value) / 100 : promo.value
}

/**
 * Résout le prix effectif d'un article pour la caisse, en tenant compte des promotions actives
 * (module product_catalog) — ciblage direct (productId) ou par catégorie (categoryId).
 * Résolu côté frontend, jamais côté backend (cf. étude "BOUTIKLIC Promotions & Rabais" : pas de
 * couplage cross-module sale/product_catalog). Si plusieurs promotions s'appliquent, la plus
 * avantageuse pour le client est retenue.
 */
export function resolvePrice(product: Product, activePromotions: PromotionResponse[], sellingPriceDecimals = 0): ResolvedPrice {
  const catalogPrice = product.salePrice
  const candidates = activePromotions.filter(
    (promo) => promo.productIds.includes(product.id) || (!!product.categoryId && promo.categoryIds.includes(product.categoryId)),
  )
  if (candidates.length === 0) {
    return { unitPrice: catalogPrice, catalogPrice: null, promotionId: null }
  }
  const best = candidates.reduce((a, b) => (discountAmount(b, catalogPrice) > discountAmount(a, catalogPrice) ? b : a))
  // Arrondi à la précision des prix de vente de la BOUTIQUE (0 par défaut, comme avant) : un prix promo de 299,997 devient 300,00
  // dans une boutique à 2 décimales, et reste entier dans une boutique à l'unité.
  const unitPrice = Math.max(0, roundHalfUp(catalogPrice - discountAmount(best, catalogPrice), sellingPriceDecimals))
  return { unitPrice, catalogPrice, promotionId: best.id }
}
