import { describe, expect, it } from 'vitest'
import { CURRENCY_DECIMALS, currencyDecimals, extractTax, resolveTaxCategory, summarizeSaleTax, type TaxContext } from '@boutiklic/shared'
import golden from '../../../packages/shared/src/tax/tax-golden-cases.json'

/**
 * Cas de référence PARTAGÉS avec le serveur : la TVA est calculée côté serveur (enregistrement) ET ici (packages/shared/src/tax,
 * estimation hors ligne) — les deux doivent donner exactement les mêmes résultats. Mêmes cas que TaxGoldenCasesTest (Java), qui
 * exerce le vrai code serveur. Un test rouge d'un seul côté = divergence : on corrige l'implémentation, pas le fichier, sauf
 * changement voulu de la règle (alors on change le fichier ET les deux côtés).
 */

describe('cas de référence partagés avec le serveur — devises', () => {
  it('chaque devise a la même précision que sur le serveur, et aucune n\'est oubliée', () => {
    expect(Object.keys(golden.currencies).sort()).toEqual(Object.keys(CURRENCY_DECIMALS).sort())
    for (const [code, decimals] of Object.entries(golden.currencies)) {
      expect(currencyDecimals(code), code).toBe(decimals)
    }
  })
})

describe('cas de référence partagés avec le serveur — TTC -> HT + TVA', () => {
  it.each(golden.extractTax)('$currency $ttc TTC à $rate %', ({ currency, ttc, rate, ht, tax }) => {
    const result = extractTax(Number(ttc), Number(rate), currencyDecimals(currency))
    expect(result.totalHt).toBe(Number(ht))
    expect(result.taxAmount).toBe(Number(tax))
  })
})

describe('cas de référence partagés avec le serveur — récapitulatif de ticket', () => {
  it.each(golden.summary)('$name', ({ currency, lines, anyTaxed, totalHt, totalTax, totalTtc }) => {
    // Une catégorie fiscale par taux distinct ; une ligne sans taux n'en référence aucune et la boutique n'a pas de défaut.
    const rates = [...new Set(lines.map((l) => l.rate).filter((r): r is string => r !== null))]
    const ctx: TaxContext = {
      enabled: true,
      defaultTaxCategoryId: null,
      taxCategories: rates.map((r) => ({ id: 'r' + r, name: r, ratePercent: Number(r) })),
      categories: [],
    }

    const summary = summarizeSaleTax(
      lines.map((l) => ({ lineTotal: Number(l.ttc), taxCategoryId: l.rate === null ? null : 'r' + l.rate })),
      ctx,
      currency,
    )

    if (!anyTaxed) {
      expect(summary).toBeNull()
      return
    }
    expect(summary).not.toBeNull()
    expect(summary!.totalHt).toBe(Number(totalHt))
    expect(summary!.totalTax).toBe(Number(totalTax))
    expect(summary!.totalTtc).toBe(Number(totalTtc))
  })
})

describe('cas de référence partagés avec le serveur — cascade article > catégorie > boutique', () => {
  it.each(golden.cascade)('$name', (c) => {
    const ctx = { ...golden.cascadeContext, ...(c as { contextOverride?: Partial<TaxContext> }).contextOverride } as TaxContext

    const result = resolveTaxCategory(ctx, c.line as { taxCategoryId?: string; categoryId?: string })

    if (c.expected === null) {
      expect(result).toBeNull()
      return
    }
    expect(result?.taxCategory.id).toBe(c.expected.taxCategoryId)
    expect(result?.taxCategory.ratePercent).toBe(c.expected.ratePercent)
    expect(result?.source).toBe(c.expected.source)
  })
})
