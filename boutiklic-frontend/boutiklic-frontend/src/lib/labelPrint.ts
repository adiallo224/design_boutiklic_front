import {
  MAX_COPIES_PER_PRODUCT,
  clampCopies,
  mergePreselection,
  parsePreselection,
  toLabelModel as toSharedLabelModel,
  type LabelModel,
  type LabelPreselection,
} from '@boutiklic/shared'
import type { Product } from '../types'
import { resolvePrice } from './promotionPricing'
import type { PromotionResponse } from './promotionsApi'

export { MAX_COPIES_PER_PRODUCT }
export type { LabelPreselection }

export const LABELS_PATH = '/stock/etiquettes'
export const PRINT_SETTINGS_PATH = '/reglages?tab=impression'

/**
 * Articles pré-sélectionnés par un raccourci contextuel (fiche article, plus tard arrivage…), lus dans l'URL de
 * la page Étiquettes : `?product=<id>` (1 exemplaire) ou `?items=<id>:<n>,<id>:<n>` (quantités, ex. unités
 * reçues à l'arrivage). Tolérant : entrée mal formée ignorée, jamais d'exception. Le parsing vit dans
 * @boutiklic/shared (le mobile le réutilise).
 */
export function parseLabelPreselection(params: URLSearchParams): LabelPreselection[] {
  return parsePreselection(params.get('product'), params.get('items'))
}

/** Lien vers la page Étiquettes avec des articles pré-sélectionnés. */
export function buildLabelsPath(items: LabelPreselection[]): string {
  if (items.length === 0) return LABELS_PATH
  if (items.length === 1 && items[0].copies === 1) return `${LABELS_PATH}?product=${encodeURIComponent(items[0].productId)}`
  const encoded = items.map((i) => `${encodeURIComponent(i.productId)}:${clampCopies(i.copies)}`).join(',')
  return `${LABELS_PATH}?items=${encoded}`
}

/**
 * Article du catalogue → étiquette. Avec `promotions`, applique le prix promo (ancien prix barré) via la
 * même résolution que la caisse (`resolvePrice`) ; sans, prix catalogue.
 */
export function toLabelModel(product: Product, copies: number, promotions: PromotionResponse[] | null): LabelModel {
  return toSharedLabelModel(product, copies, promotions ? resolvePrice(product, promotions) : null)
}

/** État de navigation (router) porteur d'une présélection — évite de fabriquer une URL de plusieurs Ko pour un arrivage
 *  ou une sélection de plusieurs dizaines d'articles. Perdu au rechargement de la page (acceptable : l'utilisateur
 *  recoche). */
export interface LabelsLocationState {
  preselection: LabelPreselection[]
}

/** Relit l'état de navigation de façon défensive (il vient de l'historique du navigateur : jamais de confiance). */
export function readPreselectionState(state: unknown): LabelPreselection[] | null {
  if (typeof state !== 'object' || state === null) return null
  const raw = (state as { preselection?: unknown }).preselection
  if (!Array.isArray(raw)) return null
  const items: { productId: string; copies: number }[] = []
  for (const entry of raw) {
    if (typeof entry !== 'object' || entry === null) continue
    const { productId, copies } = entry as { productId?: unknown; copies?: unknown }
    if (typeof productId === 'string' && productId !== '' && typeof copies === 'number') items.push({ productId, copies })
  }
  return items.length > 0 ? mergePreselection(items) : null
}

/** Destination de la page Étiquettes pour ces articles : un seul article à 1 exemplaire → URL lisible ; sinon état de navigation. */
export function labelsNavigation(items: readonly { productId: string; copies: number }[]): { to: string; state?: LabelsLocationState } {
  const merged = mergePreselection(items)
  if (merged.length === 0) return { to: LABELS_PATH }
  if (merged.length === 1 && merged[0].copies === 1) return { to: buildLabelsPath(merged) }
  return { to: LABELS_PATH, state: { preselection: merged } }
}
