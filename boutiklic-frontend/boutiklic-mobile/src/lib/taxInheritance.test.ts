import { inheritedTax } from './taxInheritance'
import type { CategoryResponse } from './categoriesApi'
import type { TaxCategoryResponse } from './taxApi'

const tax = (id: string, ratePercent: number): TaxCategoryResponse => ({ id, name: id, active: true, ratePercent })
const cat = (id: string, parentId: string | null, taxCategoryId: string | null = null): CategoryResponse => ({
  id, name: id, color: '#000', icon: null, parentId, depth: parentId ? 2 : 1, position: 0, taxCategoryId,
})

const TAXES = [tax('standard', 18), tax('reduced', 5.5), tax('exempt', 0)]

describe('inheritedTax', () => {
  it('prend la catégorie la plus proche portant une TVA', () => {
    const categories = [cat('food', null, 'reduced'), cat('rice', 'food', 'exempt'), cat('basmati', 'rice')]
    const result = inheritedTax('basmati', categories, TAXES, 'standard', true)
    expect(result.source).toBe('category')
    expect(result.taxCategory?.id).toBe('exempt')
  })

  it("remonte jusqu'au parent quand la sous-catégorie n'a pas de TVA propre", () => {
    const categories = [cat('food', null, 'reduced'), cat('rice', 'food')]
    expect(inheritedTax('rice', categories, TAXES, 'standard', true).taxCategory?.id).toBe('reduced')
  })

  it('retombe sur le défaut de la boutique', () => {
    const result = inheritedTax('food', [cat('food', null)], TAXES, 'standard', true)
    expect(result.source).toBe('shop')
    expect(result.taxCategory?.id).toBe('standard')
  })

  it('un taux 0 % explicite est un vrai taux, pas une absence de TVA', () => {
    const result = inheritedTax('books', [cat('books', null, 'exempt')], TAXES, 'standard', true)
    expect(result.source).toBe('category')
    expect(result.taxCategory?.ratePercent).toBe(0)
  })

  it("aucune TVA quand la boutique ne l'applique pas", () => {
    expect(inheritedTax('food', [cat('food', null, 'reduced')], TAXES, 'standard', false).source).toBe('none')
  })

  it("aucune TVA quand rien n'est configuré", () => {
    expect(inheritedTax('food', [cat('food', null)], TAXES, null, true).source).toBe('none')
  })
})
