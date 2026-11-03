import { describe, expect, it } from 'vitest'
import { forgetKey, keyFor, newKey, requestSignature, type KeyStore } from '../lib/idempotency'

function memoryStore(): KeyStore & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return { data, get: (n) => data.get(n) ?? null, set: (n, v) => void data.set(n, v), remove: (n) => void data.delete(n) }
}
const base = { items: [{ productId: 'b', quantity: 1 }, { productId: 'a', quantity: 2 }], deliveryMethod: 'DELIVERY', area: 'Kaloum', paymentMethod: 'COD', buyerPhone: '+224 620 00 00 00', expectedTotal: 5000 }

describe('clé d\'idempotence', () => {
  it('une clé UUID v4 en minuscules', () => {
    expect(newKey()).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(newKey(() => 'ABC')).toBe('abc')
  })
  it('la même demande retrouve la même clé (nouvel essai après une coupure)', () => {
    const store = memoryStore()
    const sig = requestSignature(base)
    expect(keyFor(sig, store)).toBe(keyFor(sig, store))
  })
  it('une demande différente reçoit une clé neuve', () => {
    const store = memoryStore()
    const first = keyFor(requestSignature(base), store)
    const second = keyFor(requestSignature({ ...base, expectedTotal: 5500 }), store)
    expect(second).not.toBe(first)
  })
  it("l'ordre des lignes, la casse du lieu et les espaces du téléphone ne changent pas la signature", () => {
    const reordered = { ...base, items: [...base.items].reverse(), area: ' kaloum ', buyerPhone: '+224620000000' }
    expect(requestSignature(reordered)).toBe(requestSignature(base))
  })
  it('chaque élément décidé par l\'acheteur change la signature', () => {
    const sig = requestSignature(base)
    for (const changed of [{ deliveryMethod: 'PICKUP' }, { area: 'Dixinn' }, { pickupPointId: 'pp' }, { paymentMethod: 'PICKUP_PAYMENT' }, { buyerPhone: '+224621111111' }, { items: [{ productId: 'a', quantity: 3 }, { productId: 'b', quantity: 1 }] }]) {
      expect(requestSignature({ ...base, ...changed })).not.toBe(sig)
    }
  })
  it('un stockage illisible donne une clé neuve, sans erreur', () => {
    const store = memoryStore()
    store.set('boutiklic.order-key.v1', 'pas du json')
    expect(keyFor('x', store)).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('oublier la clé après la commande: la suivante a la sienne', () => {
    const store = memoryStore()
    const sig = requestSignature(base)
    const first = keyFor(sig, store)
    forgetKey(store)
    expect(keyFor(sig, store)).not.toBe(first)
  })
})
