import type { ResolvedTax, TaxContext, TaxSubject } from './types'

/** Garde-fou anti-cycle en remontant les parents (profondeur max 3 côté serveur). */
const MAX_HOPS = 10

/**
 * ATTENTION : cette cascade existe aussi côté serveur. Les deux sont verrouillées par les cas partagés de tax-golden-cases.json
 * (TaxGoldenCasesTest côté Java, sharedTaxGolden.test.ts côté frontend) : changer la règle = changer ce fichier et les deux côtés.
 *
 * Cascade article > catégorie > boutique — miroir de ProductQueryService.getEffectiveTaxCategoryId (article, puis catégorie la
 * plus proche portant une TVA en remontant les parents) suivi de TaxCategoryQueryService.resolve (défaut de la boutique).
 *
 * Comme le serveur, l'étage est choisi AVANT de chercher son taux : si la catégorie fiscale retenue est inconnue ou n'a pas de
 * taux en vigueur, il n'y a pas de TVA — on ne retombe jamais sur un étage inférieur, et jamais sur un taux 0 implicite.
 * Boutique sans TVA activée : jamais de TVA.
 *
 * @returns null quand aucune TVA ne s'applique.
 */
export function resolveTaxCategory(ctx: TaxContext, subject: TaxSubject = {}): ResolvedTax | null {
  if (!ctx.enabled) return null

  let taxCategoryId: string | null = null
  let source: ResolvedTax['source'] = 'shop'

  if (subject.taxCategoryId) {
    taxCategoryId = subject.taxCategoryId
    source = 'product'
  } else {
    const byId = new Map(ctx.categories.map((c) => [c.id, c]))
    let current = subject.categoryId ? byId.get(subject.categoryId) : undefined
    for (let hops = 0; current && hops < MAX_HOPS; hops++) {
      if (current.taxCategoryId) {
        taxCategoryId = current.taxCategoryId
        source = 'category'
        break
      }
      current = current.parentId ? byId.get(current.parentId) : undefined
    }
  }

  if (taxCategoryId === null) {
    taxCategoryId = ctx.defaultTaxCategoryId
    source = 'shop'
  }
  if (taxCategoryId === null) return null

  const taxCategory = ctx.taxCategories.find((c) => c.id === taxCategoryId)
  if (!taxCategory || taxCategory.ratePercent === null) return null
  return { source, taxCategory }
}
