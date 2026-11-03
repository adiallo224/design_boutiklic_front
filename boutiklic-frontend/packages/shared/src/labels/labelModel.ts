import type { LabelModel } from './types'

export const MAX_COPIES_PER_PRODUCT = 999

export function clampCopies(value: number): number {
  return Math.min(MAX_COPIES_PER_PRODUCT, Math.max(1, Math.floor(value)))
}

/** Article + nombre d'exemplaires pré-sélectionnés par un raccourci contextuel (fiche article, arrivage…). */
export interface LabelPreselection {
  productId: string
  copies: number
}

/**
 * Lit une présélection depuis les deux formes d'URL de la page Étiquettes web : `product=<id>` (1 exemplaire)
 * et `items=<id>:<n>,<id>:<n>` (quantités, ex. unités reçues à l'arrivage). Sans dépendance à `URLSearchParams`
 * (utilisable telle quelle côté mobile). Tolérant : entrée mal formée ignorée, jamais d'exception ; un même
 * article répété garde la dernière quantité.
 */
export function parsePreselection(product: string | null | undefined, items: string | null | undefined): LabelPreselection[] {
  const byId = new Map<string, number>()
  if (product) byId.set(product, 1)
  if (items) {
    for (const part of items.split(',')) {
      const [id, qty] = part.split(':')
      if (!id) continue
      const copies = qty === undefined ? 1 : Number(qty)
      byId.set(id, Number.isFinite(copies) ? clampCopies(copies) : 1)
    }
  }
  return [...byId].map(([productId, copies]) => ({ productId, copies }))
}

/** Champs d'un article utiles à l'étiquette — le `Product` du web et celui du mobile y sont structurellement conformes. */
export interface LabelableProduct {
  id: string
  name: string
  barcode?: string
  category: string
  categoryId?: string
  salePrice: number
  currency: string
}

/** Prix résolu (promotion éventuelle) — même résultat que `resolvePrice` de chaque app. */
export interface ResolvedLabelPrice {
  unitPrice: number
  /** Prix catalogue avant promotion — null si aucune promotion ne s'applique. */
  catalogPrice: number | null
}

/** Article du catalogue → étiquette. Sans `resolved`, prix catalogue. */
export function toLabelModel(product: LabelableProduct, copies: number, resolved: ResolvedLabelPrice | null): LabelModel {
  return {
    productId: product.id,
    name: product.name,
    price: resolved?.unitPrice ?? product.salePrice,
    previousPrice: resolved?.catalogPrice ?? null,
    currency: product.currency,
    barcode: product.barcode ?? null,
    // « Sans catégorie » est un libellé d'affichage, pas une catégorie à imprimer.
    categoryName: product.categoryId ? product.category : null,
    copies,
  }
}

/**
 * Fusionne les lignes d'un même article en SOMMANT leurs quantités (un arrivage peut contenir deux lignes du même
 * article), bornées à 1..999 ; les lignes à quantité nulle ou invalide comptent pour 1 exemplaire minimum. L'ordre
 * de première apparition est conservé.
 */
export function mergePreselection(items: readonly { productId: string; copies: number }[]): LabelPreselection[] {
  const totals = new Map<string, number>()
  for (const item of items) {
    const copies = Number.isFinite(item.copies) ? Math.max(0, Math.floor(item.copies)) : 0
    totals.set(item.productId, (totals.get(item.productId) ?? 0) + copies)
  }
  return [...totals].map(([productId, copies]) => ({ productId, copies: clampCopies(copies) }))
}

/** Cibles d'une promotion (produits et catégories exactes) — sous-ensemble de `PromotionResponse` de chaque app. */
export interface PromotionTargets {
  productIds: readonly string[]
  categoryIds: readonly string[]
}

/**
 * Une promotion s'applique-t-elle à cet article ? MÊME règle que `resolvePrice` de chaque app (caisse) : produit
 * ciblé directement, ou catégorie EXACTE de l'article (pas de descendance dans l'arbre des catégories). Le test de
 * cohérence (web et mobile) vérifie l'équivalence avec `resolvePrice` : sinon l'étiquette et la caisse
 * afficheraient des prix différents.
 */
export function isTargetedByPromotion(promotion: PromotionTargets, product: { id: string; categoryId?: string }): boolean {
  return promotion.productIds.includes(product.id) || (!!product.categoryId && promotion.categoryIds.includes(product.categoryId))
}

/** Ids des articles visés par au moins une des promotions données (ordre du catalogue conservé). */
export function promotedProductIds(promotions: readonly PromotionTargets[], products: readonly { id: string; categoryId?: string }[]): string[] {
  if (promotions.length === 0) return []
  return products.filter((p) => promotions.some((promo) => isTargetedByPromotion(promo, p))).map((p) => p.id)
}
