import { describe, expect, it } from 'vitest'
import { A4_PRESETS, ROLL_PRESETS, layoutForPreset } from '@boutiklic/shared/src/labels/layouts'
import { mmToPoints, pageSizePoints } from '@boutiklic/shared/src/labels/pageSize'
import { MAX_COPIES_PER_PRODUCT, clampCopies, parsePreselection, toLabelModel, type LabelableProduct } from '@boutiklic/shared/src/labels/labelModel'
import { generateInternalCodes } from '@boutiklic/shared/src/labels/internalCodes'

describe('pageSizePoints (expo-print : points, entiers)', () => {
  it('A4 = 595 × 842', () => {
    expect(pageSizePoints(layoutForPreset('a4-full')!)).toEqual({ width: 595, height: 842 })
  })

  it('rouleaux thermiques', () => {
    expect(pageSizePoints(layoutForPreset('roll-50x30')!)).toEqual({ width: 142, height: 85 })
    expect(pageSizePoints(layoutForPreset('roll-40x30')!)).toEqual({ width: 113, height: 85 })
  })

  it('renvoie toujours des entiers (Android : width/height sont des Int)', () => {
    for (const id of [...A4_PRESETS.map((p) => p.id), ...ROLL_PRESETS.map((p) => p.id)]) {
      const { width, height } = pageSizePoints(layoutForPreset(id)!)
      expect(Number.isInteger(width)).toBe(true)
      expect(Number.isInteger(height)).toBe(true)
    }
  })

  it('l’arrondi reste sous 0,2 mm', () => {
    for (const mm of [50, 40, 30, 210, 297, 148.5, 105]) {
      const roundedMm = (Math.round(mmToPoints(mm)) * 25.4) / 72
      expect(Math.abs(roundedMm - mm)).toBeLessThan(0.2)
    }
  })
})

describe('clampCopies / parsePreselection', () => {
  it('borne à 1..999 et arrondit vers le bas', () => {
    expect(clampCopies(0)).toBe(1)
    expect(clampCopies(-3)).toBe(1)
    expect(clampCopies(2.9)).toBe(2)
    expect(clampCopies(10_000)).toBe(MAX_COPIES_PER_PRODUCT)
  })

  it('product → 1 exemplaire ; items → quantités ; sans rien → vide', () => {
    expect(parsePreselection('a', null)).toEqual([{ productId: 'a', copies: 1 }])
    expect(parsePreselection(null, 'a:3,b:12')).toEqual([
      { productId: 'a', copies: 3 },
      { productId: 'b', copies: 12 },
    ])
    expect(parsePreselection(null, null)).toEqual([])
    expect(parsePreselection(undefined, undefined)).toEqual([])
  })

  it('tolère les entrées mal formées et fusionne les doublons (le dernier gagne)', () => {
    expect(parsePreselection(null, ',:5,a:1,a:4,b:x')).toEqual([
      { productId: 'a', copies: 4 },
      { productId: 'b', copies: 1 },
    ])
  })
})

const product = (overrides: Partial<LabelableProduct> = {}): LabelableProduct => ({
  id: 'p1',
  name: 'Sac de riz',
  barcode: '4006381333931',
  category: 'Alimentation',
  categoryId: 'cat-1',
  salePrice: 100000,
  currency: 'GNF',
  ...overrides,
})

describe('toLabelModel', () => {
  it('prix catalogue sans prix résolu', () => {
    expect(toLabelModel(product(), 3, null)).toMatchObject({ productId: 'p1', price: 100000, previousPrice: null, copies: 3, barcode: '4006381333931' })
  })

  it('prix promo + ancien prix quand une promotion a été résolue', () => {
    const label = toLabelModel(product(), 1, { unitPrice: 90000, catalogPrice: 100000 })
    expect(label.price).toBe(90000)
    expect(label.previousPrice).toBe(100000)
  })

  it('article sans code-barres / sans catégorie', () => {
    const label = toLabelModel(product({ barcode: undefined, categoryId: undefined, category: 'Sans catégorie' }), 1, null)
    expect(label.barcode).toBeNull()
    expect(label.categoryName).toBeNull()
  })
})

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0))

describe('generateInternalCodes', () => {
  it('traite tous les articles et notifie chacun', async () => {
    const assigned: string[] = []
    const settled: string[] = []
    const result = await generateInternalCodes({
      ids: ['a', 'b', 'c', 'd', 'e'],
      assign: async (id) => `code-${id}`,
      onAssigned: (id, code) => assigned.push(`${id}=${code}`),
      onSettled: (id) => settled.push(id),
    })
    expect(result).toEqual({ generated: 5, failure: null })
    expect(assigned.sort()).toEqual(['a=code-a', 'b=code-b', 'c=code-c', 'd=code-d', 'e=code-e'])
    expect(settled.sort()).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('ne dépasse jamais la concurrence demandée (3 par défaut)', async () => {
    let inFlight = 0
    let peak = 0
    const ids = Array.from({ length: 12 }, (_, i) => `id-${i}`)
    await generateInternalCodes({
      ids,
      assign: async () => {
        inFlight++
        peak = Math.max(peak, inFlight)
        await tick()
        inFlight--
        return 'x'
      },
    })
    expect(peak).toBe(3)

    peak = 0
    await generateInternalCodes({ ids, concurrency: 1, assign: async () => { inFlight++; peak = Math.max(peak, inFlight); await tick(); inFlight--; return 'x' } })
    expect(peak).toBe(1)
  })

  it('s’arrête à la première erreur : renvoie l’erreur, ne lance plus rien, libère tous les articles', async () => {
    const started: string[] = []
    const settled: string[] = []
    const boom = new Error('réseau')
    const result = await generateInternalCodes({
      ids: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
      concurrency: 1,
      assign: async (id) => {
        started.push(id)
        if (id === 'c') throw boom
        return id
      },
      onSettled: (id) => settled.push(id),
    })
    expect(result.failure).toBe(boom)
    expect(result.generated).toBe(2) // a, b
    expect(started).toEqual(['a', 'b', 'c']) // d..h jamais démarrés
    expect(settled.sort()).toEqual(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']) // tous libérés, y compris ceux jamais traités
  })

  it('une erreur avec plusieurs requêtes en vol : les requêtes parties terminent, la première erreur est renvoyée', async () => {
    const first = new Error('première')
    const second = new Error('seconde')
    const result = await generateInternalCodes({
      ids: ['a', 'b', 'c', 'd', 'e'],
      concurrency: 3,
      assign: async (id) => {
        await tick()
        if (id === 'a') throw first
        if (id === 'b') throw second
        return id
      },
    })
    expect(result.failure).toBe(first)
  })

  it('liste vide → rien à faire, sans erreur', async () => {
    let calls = 0
    const result = await generateInternalCodes({ ids: [], assign: async () => { calls++; return 'x' } })
    expect(result).toEqual({ generated: 0, failure: null })
    expect(calls).toBe(0)
  })
})
