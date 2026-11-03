import { describe, expect, it } from 'vitest'
import { MAX_LINES, MAX_QUANTITY, addItem, estimatedSubtotal, itemCount, parseCart, removeItem, serializeCart, setQuantity, type CartItem } from '../lib/cart'

const rice = { productId: 'rice', name: 'Riz', imageUrl: null, unitPrice: 1500, currency: 'GNF' }
const oil = { productId: 'oil', name: 'Huile', imageUrl: null, unitPrice: 900, currency: 'GNF' }

describe('panier', () => {
  it('ajoute puis cumule les quantités', () => {
    const cart = addItem(addItem([], rice, 2), rice, 3)
    expect(cart).toHaveLength(1)
    expect(cart[0].quantity).toBe(5)
  })
  it('ne change rien pour une quantité nulle, négative ou illisible', () => {
    for (const q of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) expect(addItem([], rice, q)).toEqual([])
  })
  it('plafonne la quantité', () => expect(addItem(addItem([], rice, 900), rice, 900)[0].quantity).toBe(MAX_QUANTITY))
  it('plafonne le nombre de lignes', () => {
    let cart: CartItem[] = []
    for (let i = 0; i < MAX_LINES + 5; i++) cart = addItem(cart, { ...rice, productId: 'p' + i })
    expect(cart).toHaveLength(MAX_LINES)
  })
  it('fixe une quantité, et 0 retire la ligne', () => {
    const cart = addItem(addItem([], rice, 2), oil, 1)
    expect(setQuantity(cart, 'rice', 7).find((l) => l.productId === 'rice')?.quantity).toBe(7)
    expect(setQuantity(cart, 'rice', 0).map((l) => l.productId)).toEqual(['oil'])
    expect(removeItem(cart, 'oil').map((l) => l.productId)).toEqual(['rice'])
  })
  it('compte et estime', () => {
    const cart = addItem(addItem([], rice, 2), oil, 1)
    expect(itemCount(cart)).toBe(3)
    expect(estimatedSubtotal(cart)).toBe(3900)
  })
  it("met à jour le prix affiché quand l'article est ré-ajouté", () => {
    expect(addItem(addItem([], rice), { ...rice, unitPrice: 1200 })[0].unitPrice).toBe(1200)
  })
})

describe('relecture du stockage', () => {
  it('relit ce qu\'elle a écrit', () => {
    const cart = addItem(addItem([], rice, 2), oil, 1)
    expect(parseCart(serializeCart(cart))).toEqual(cart)
  })
  it.each([null, undefined, '', 'pas du json', '{}', '"x"', '123', 'null', '[null, 3, "a"]'])('donne un panier vide pour %j', (raw) => {
    expect(parseCart(raw as string)).toEqual([])
  })
  it('écarte les lignes invalides et garde les valables', () => {
    const raw = JSON.stringify([
      { productId: 'ok', name: 'Bon', quantity: 2, unitPrice: 100, currency: 'GNF' },
      { productId: '../../etc', name: 'Piège', quantity: 1 },
      { productId: 'sans-nom', quantity: 1 },
      { productId: 'zero', name: 'Zéro', quantity: 0 },
      { productId: 'neg', name: 'Négatif', quantity: -4 },
      { productId: 'ok', name: 'Doublon', quantity: 9 },
    ])
    expect(parseCart(raw).map((l) => l.productId)).toEqual(['ok'])
  })
  it('borne les quantités, les prix et le nombre de lignes lus', () => {
    expect(parseCart(JSON.stringify([{ productId: 'a', name: 'A', quantity: 10 ** 9, unitPrice: -5 }]))[0]).toMatchObject({ quantity: MAX_QUANTITY, unitPrice: 0 })
    const many = Array.from({ length: 500 }, (_, i) => ({ productId: 'p' + i, name: 'x', quantity: 1 }))
    expect(parseCart(JSON.stringify(many))).toHaveLength(MAX_LINES)
  })
})
