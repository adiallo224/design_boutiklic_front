import { describe, expect, it } from 'vitest'
import { extractTax, resolveTaxCategory, summarizeSaleTax, type TaxContext } from '@boutiklic/shared'

const ctx = (overrides: Partial<TaxContext> = {}): TaxContext => ({
  enabled: true,
  defaultTaxCategoryId: 'standard',
  taxCategories: [
    { id: 'standard', name: 'Normale', ratePercent: 18 },
    { id: 'reduced', name: 'Réduit', ratePercent: 5.5 },
    { id: 'exempt', name: 'Exonéré', ratePercent: 0 },
    { id: 'norule', name: 'Sans règle', ratePercent: null },
  ],
  categories: [
    { id: 'food', parentId: null, taxCategoryId: 'reduced' },
    { id: 'rice', parentId: 'food', taxCategoryId: null },
    { id: 'books', parentId: null, taxCategoryId: 'exempt' },
    { id: 'misc', parentId: null, taxCategoryId: null },
  ],
  ...overrides,
})

describe('resolveTaxCategory — cascade article > catégorie > boutique', () => {
  it("l'article l'emporte sur sa catégorie", () => {
    const r = resolveTaxCategory(ctx(), { taxCategoryId: 'exempt', categoryId: 'food' })
    expect(r?.source).toBe('product')
    expect(r?.taxCategory.id).toBe('exempt')
  })

  it('la catégorie la plus proche, parents compris', () => {
    const r = resolveTaxCategory(ctx(), { categoryId: 'rice' })
    expect(r?.source).toBe('category')
    expect(r?.taxCategory.id).toBe('reduced')
  })

  it('retombe sur le défaut de la boutique (catégorie sans TVA, article sans catégorie, ligne libre)', () => {
    expect(resolveTaxCategory(ctx(), { categoryId: 'misc' })?.source).toBe('shop')
    expect(resolveTaxCategory(ctx(), {})?.taxCategory.id).toBe('standard')
    expect(resolveTaxCategory(ctx())?.taxCategory.id).toBe('standard')
  })

  it('un taux 0 % explicite est une vraie TVA (à 0), pas une absence de TVA', () => {
    const r = resolveTaxCategory(ctx(), { categoryId: 'books' })
    expect(r?.taxCategory.ratePercent).toBe(0)
  })

  it('aucune TVA quand la boutique ne l\'applique pas, même avec une TVA sur l\'article', () => {
    expect(resolveTaxCategory(ctx({ enabled: false }), { taxCategoryId: 'standard' })).toBeNull()
  })

  it("aucune TVA sans défaut ni TVA propre — jamais un taux 0 implicite", () => {
    expect(resolveTaxCategory(ctx({ defaultTaxCategoryId: null }), { categoryId: 'misc' })).toBeNull()
  })

  it("comme le serveur, un étage sans taux en vigueur ne retombe pas sur l'étage du dessous", () => {
    expect(resolveTaxCategory(ctx(), { taxCategoryId: 'norule', categoryId: 'food' })).toBeNull()
    expect(resolveTaxCategory(ctx(), { taxCategoryId: 'inconnue' })).toBeNull()
  })
})

describe('extractTax — TTC -> HT arrondi comme SaleLine (HALF_UP à la précision de la devise)', () => {
  it('18 % en GNF : 118 000 TTC = 100 000 HT + 18 000', () => {
    expect(extractTax(118000, 18, 0)).toEqual({ totalHt: 100000, taxAmount: 18000 })
  })

  it('arrondit le HT une seule fois, la TVA est le reste', () => {
    // 1000 / 1,055 = 947,867... -> 948 ; TVA = 52
    expect(extractTax(1000, 5.5, 0)).toEqual({ totalHt: 948, taxAmount: 52 })
  })

  it("un .5 exact s'arrondit vers le haut, sans dérive de flottants", () => {
    // 1 / 2 = 0,5 -> 1 (HALF_UP) ; 1,05 / 1,05 = 1 ; 0,25 TTC à 100 % -> HT 0,125 -> 0,13 en 2 décimales
    expect(extractTax(1, 100, 0)).toEqual({ totalHt: 1, taxAmount: 0 })
    expect(extractTax(0.25, 100, 2)).toEqual({ totalHt: 0.13, taxAmount: 0.12 })
  })

  it('taux 0 : tout est HT', () => {
    expect(extractTax(5000, 0, 0)).toEqual({ totalHt: 5000, taxAmount: 0 })
  })

  it('devise à 2 décimales', () => {
    expect(extractTax(12.1, 21, 2)).toEqual({ totalHt: 10, taxAmount: 2.1 })
  })

  it('HT + TVA = TTC, pour tout un balayage de montants et de taux', () => {
    for (const rate of [0, 5, 5.5, 10, 18, 19.25, 20]) {
      for (let ttc = 0; ttc <= 3000; ttc += 7) {
        const { totalHt, taxAmount } = extractTax(ttc, rate, 0)
        expect(totalHt + taxAmount).toBe(ttc)
        expect(Number.isInteger(totalHt)).toBe(true)
      }
    }
  })
})

describe('summarizeSaleTax — récapitulatif de ticket', () => {
  it('mélange de taux : chaque ligne suit sa cascade, les totaux sont la somme des lignes', () => {
    const summary = summarizeSaleTax(
      [
        { lineTotal: 118000, taxCategoryId: null, categoryId: 'misc' }, // boutique 18 %
        { lineTotal: 10550, categoryId: 'rice' }, // catégorie 5,5 %
        { lineTotal: 5000, taxCategoryId: 'exempt' }, // article exonéré
      ],
      ctx(),
      'GNF',
    )
    expect(summary).not.toBeNull()
    expect(summary!.lines.map((l) => l.ratePercent)).toEqual([18, 5.5, 0])
    expect(summary!.totalTtc).toBe(133550)
    expect(summary!.totalHt + summary!.totalTax).toBe(133550)
    expect(summary!.totalTax).toBe(18000 + 550)
  })

  it('une ligne sans TVA applicable reste HT = TTC', () => {
    const summary = summarizeSaleTax([{ lineTotal: 2000, taxCategoryId: 'norule' }, { lineTotal: 1180, taxCategoryId: 'standard' }], ctx(), 'GNF')
    expect(summary!.lines[0]).toEqual({ taxCategoryId: null, ratePercent: null, totalHt: 2000, taxAmount: 0 })
    expect(summary!.totalTtc).toBe(3180)
  })

  it("null quand aucune ligne n'a de TVA (boutique sans TVA)", () => {
    expect(summarizeSaleTax([{ lineTotal: 1000 }], ctx({ enabled: false }), 'GNF')).toBeNull()
  })
})
