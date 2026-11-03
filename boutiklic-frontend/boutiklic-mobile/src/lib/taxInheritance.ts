import { resolveTaxCategory } from '@boutiklic/shared'
import type { CategoryResponse } from './categoriesApi'
import type { TaxCategoryResponse } from './taxApi'

/** D'où vient la TVA qui s'applique quand l'élément n'a pas de TVA propre. */
export type InheritedTaxSource = 'category' | 'shop' | 'none'

export interface InheritedTax {
  source: InheritedTaxSource
  taxCategory: TaxCategoryResponse | null
}

/**
 * Cascade article > catégorie > boutique, vue de ce qu'un article (ou une sous-catégorie) HÉRITE s'il n'a pas de TVA propre :
 * la catégorie la plus proche de `startCategoryId` (elle-même comprise) qui en porte une, en remontant les parents, sinon le
 * défaut de la boutique. Informatif (libellé « Hérité de … ») : le serveur reste seul juge du taux appliqué à la vente.
 * La résolution elle-même vit dans @boutiklic/shared (resolveTaxCategory), partagée avec le calcul hors ligne.
 */
export function inheritedTax(
  startCategoryId: string | null | undefined,
  categories: CategoryResponse[],
  taxCategories: TaxCategoryResponse[],
  shopDefaultTaxCategoryId: string | null,
  taxEnabled: boolean,
): InheritedTax {
  const resolved = resolveTaxCategory(
    { enabled: taxEnabled, defaultTaxCategoryId: shopDefaultTaxCategoryId, taxCategories, categories },
    { categoryId: startCategoryId },
  )
  if (!resolved) return { source: 'none', taxCategory: null }
  const taxCategory = taxCategories.find((c) => c.id === resolved.taxCategory.id) ?? null
  return { source: resolved.source === 'shop' ? 'shop' : 'category', taxCategory }
}

/** « 18 », « 5.5 » : le taux sans zéros inutiles. */
export function formatTaxRate(ratePercent: number | null): string {
  return ratePercent === null ? '—' : String(Number(ratePercent.toFixed(2)))
}
