import { describe, expect, it } from 'vitest'
import { SLUG_MAX, slugProblem, slugify } from './slug'

describe('slugify', () => {
  it.each([
    ['Chez Mamadou & Fils', 'chez-mamadou-fils'],
    ['  Boutique   Étoile  ', 'boutique-etoile'],
    ['Élevage de Kankan', 'elevage-de-kankan'],
    ['Ça va très bien', 'ca-va-tres-bien'],
    ['--Riz--', 'riz'],
    ['A/B\\C', 'a-b-c'],
    ['', ''],
    ['!!!', ''],
  ])('%j devient %j', (input, expected) => expect(slugify(input)).toBe(expected))

  it('tronque à la longueur maximale sans finir par un tiret', () => {
    const result = slugify('a'.repeat(39) + ' bbbbbbbb')
    expect(result.length).toBeLessThanOrEqual(SLUG_MAX)
    expect(result.endsWith('-')).toBe(false)
  })

  it("ne produit jamais une adresse que ses propres règles refusent (hors longueur minimale)", () => {
    for (const name of ['Chez Mamadou & Fils', 'Électro 2000', '100 % bio', 'Ma boutique — Conakry']) {
      const problem = slugProblem(slugify(name))
      expect(problem === null || problem === 'tooShort' || problem === 'digitsOnly', `${name} -> ${slugify(name)} -> ${problem}`).toBe(true)
    }
  })
})

describe('slugProblem', () => {
  it.each([
    ['ab', 'tooShort'],
    ['', 'tooShort'],
    ['a'.repeat(41), 'tooLong'],
    ['Mamode', 'chars'],
    ['ma mode', 'chars'],
    ['ma_mode', 'chars'],
    ['-mamode', 'hyphens'],
    ['mamode-', 'hyphens'],
    ['ma--mode', 'hyphens'],
    ['123456', 'digitsOnly'],
  ])('%j -> %s', (slug, problem) => expect(slugProblem(slug)).toBe(problem))

  it.each(['mamode', 'chez-mamode', 'boutique-2000', 'abc', 'a1b', 'a'.repeat(40)])('accepte %s', (slug) => expect(slugProblem(slug)).toBeNull())
})
