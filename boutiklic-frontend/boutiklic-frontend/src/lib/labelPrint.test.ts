import { describe, expect, it } from 'vitest'
import { LABELS_PATH, MAX_COPIES_PER_PRODUCT, buildLabelsPath, labelsNavigation, parseLabelPreselection, readPreselectionState, toLabelModel } from './labelPrint'
import type { Product } from '../types'
import type { PromotionResponse } from './promotionsApi'

const parse = (query: string) => parseLabelPreselection(new URLSearchParams(query))

describe('parseLabelPreselection', () => {
  it('?product=<id> → 1 exemplaire', () => {
    expect(parse('product=abc')).toEqual([{ productId: 'abc', copies: 1 }])
  })

  it('?items=<id>:<n>,… → quantités', () => {
    expect(parse('items=a:3,b:12')).toEqual([
      { productId: 'a', copies: 3 },
      { productId: 'b', copies: 12 },
    ])
  })

  it('sans quantité → 1', () => {
    expect(parse('items=a,b:2')).toEqual([
      { productId: 'a', copies: 1 },
      { productId: 'b', copies: 2 },
    ])
  })

  it('borne les quantités (≥ 1, ≤ 999) et ignore les valeurs absurdes', () => {
    expect(parse('items=a:0,b:-5,c:100000,d:x,e:2.9')).toEqual([
      { productId: 'a', copies: 1 },
      { productId: 'b', copies: 1 },
      { productId: 'c', copies: MAX_COPIES_PER_PRODUCT },
      { productId: 'd', copies: 1 },
      { productId: 'e', copies: 2 },
    ])
  })

  it('ignore les entrées vides et fusionne les doublons (le dernier gagne)', () => {
    expect(parse('items=,:5,a:1,a:4')).toEqual([{ productId: 'a', copies: 4 }])
  })

  it('aucun paramètre → aucune présélection', () => {
    expect(parse('')).toEqual([])
    expect(parse('foo=bar')).toEqual([])
  })

  it('combine ?product et ?items', () => {
    expect(parse('product=a&items=b:2')).toEqual([
      { productId: 'a', copies: 1 },
      { productId: 'b', copies: 2 },
    ])
  })
})

describe('buildLabelsPath', () => {
  it('aller-retour avec parseLabelPreselection', () => {
    for (const items of [
      [{ productId: 'a', copies: 1 }],
      [{ productId: 'a', copies: 5 }],
      [
        { productId: 'a', copies: 3 },
        { productId: 'b', copies: 7 },
      ],
    ]) {
      const path = buildLabelsPath(items)
      expect(path.startsWith(LABELS_PATH)).toBe(true)
      expect(parse(path.split('?')[1] ?? '')).toEqual(items)
    }
  })

  it('sans article : la page seule', () => {
    expect(buildLabelsPath([])).toBe(LABELS_PATH)
  })

  it('encode les identifiants', () => {
    expect(buildLabelsPath([{ productId: 'a b&c', copies: 1 }])).toBe(`${LABELS_PATH}?product=a%20b%26c`)
    expect(parse(buildLabelsPath([{ productId: 'a b&c', copies: 2 }]).split('?')[1])).toEqual([{ productId: 'a b&c', copies: 2 }])
  })
})

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1',
  name: 'Sac de riz',
  barcode: '4006381333931',
  category: 'Alimentation',
  categoryId: 'cat-1',
  purchasePrice: 80000,
  salePrice: 100000,
  currency: 'GNF',
  imageUrls: [],
  quantity: 10,
  alertThreshold: 2,
  isFavorite: false,
  isActive: true,
  ...overrides,
})

const promo = (overrides: Partial<PromotionResponse> = {}): PromotionResponse => ({
  id: 'promo-1',
  name: 'Soldes',
  type: 'PERCENTAGE',
  value: 10,
  currency: 'GNF',
  startDate: '2026-01-01T00:00:00Z',
  endDate: '2026-12-31T00:00:00Z',
  active: true,
  productIds: ['p1'],
  categoryIds: [],
  createdBy: 'u',
  createdAt: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('toLabelModel', () => {
  it('prix catalogue sans promotions', () => {
    const label = toLabelModel(product(), 3, null)
    expect(label).toMatchObject({ productId: 'p1', name: 'Sac de riz', price: 100000, previousPrice: null, currency: 'GNF', barcode: '4006381333931', copies: 3 })
  })

  it('applique le prix promo avec l’ancien prix (même résolution que la caisse)', () => {
    const label = toLabelModel(product(), 1, [promo()])
    expect(label.price).toBe(90000)
    expect(label.previousPrice).toBe(100000)
  })

  it('promo qui ne cible pas l’article : prix catalogue', () => {
    const label = toLabelModel(product(), 1, [promo({ productIds: ['autre'] })])
    expect(label.price).toBe(100000)
    expect(label.previousPrice).toBeNull()
  })

  it('article sans code-barres → barcode null', () => {
    expect(toLabelModel(product({ barcode: undefined }), 1, null).barcode).toBeNull()
  })

  it('« Sans catégorie » n’est pas imprimé comme catégorie', () => {
    expect(toLabelModel(product({ categoryId: undefined, category: 'Sans catégorie' }), 1, null).categoryName).toBeNull()
    expect(toLabelModel(product(), 1, null).categoryName).toBe('Alimentation')
  })
})

describe('labelsNavigation / readPreselectionState', () => {
  it('un article à 1 exemplaire → URL lisible, sans état', () => {
    expect(labelsNavigation([{ productId: 'a', copies: 1 }])).toEqual({ to: `${LABELS_PATH}?product=a` })
  })

  it('plusieurs articles ou plusieurs exemplaires → état de navigation (pas d’URL démesurée)', () => {
    const nav = labelsNavigation(Array.from({ length: 300 }, (_, i) => ({ productId: `id-${i}`, copies: 2 })))
    expect(nav.to).toBe(LABELS_PATH)
    expect(nav.state?.preselection).toHaveLength(300)
    expect(labelsNavigation([{ productId: 'a', copies: 5 }])).toEqual({ to: LABELS_PATH, state: { preselection: [{ productId: 'a', copies: 5 }] } })
  })

  it('fusionne les lignes d’un même article (somme)', () => {
    expect(labelsNavigation([{ productId: 'a', copies: 3 }, { productId: 'a', copies: 4 }]).state?.preselection).toEqual([{ productId: 'a', copies: 7 }])
  })

  it('aucun article → la page seule', () => {
    expect(labelsNavigation([])).toEqual({ to: LABELS_PATH })
  })

  it('aller-retour état → présélection', () => {
    const nav = labelsNavigation([{ productId: 'a', copies: 3 }, { productId: 'b', copies: 1 }])
    expect(readPreselectionState(nav.state)).toEqual([{ productId: 'a', copies: 3 }, { productId: 'b', copies: 1 }])
  })

  it.each([null, undefined, 'x', 42, {}, { preselection: 'x' }, { preselection: [] }, { preselection: [null, 3, {}, { productId: '', copies: 2 }, { productId: 'a', copies: 'x' }] }])(
    'état invalide ignoré sans lever : %j',
    (state) => {
      expect(readPreselectionState(state)).toBeNull()
    },
  )

  it('garde les entrées valides d’un état partiellement corrompu', () => {
    expect(readPreselectionState({ preselection: [{ productId: 'a', copies: 2 }, null, { productId: 'b' }] })).toEqual([{ productId: 'a', copies: 2 }])
  })
})
