import { describe, expect, it } from 'vitest'
import { comparePlans, displayedLimits } from './planComparison'

const free = { features: ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING', 'DESKTOP_AUTOUPDATE'], limits: { MAX_PRODUCTS: 100 } }
const online = {
  features: ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING', 'DESKTOP_AUTOUPDATE', 'ONLINE_STORE'],
  limits: { MAX_PRODUCTS: 500, MAX_STOREFRONTS: 1, MAX_ORDERS_PER_MONTH: 200 },
}
const business = {
  features: ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING', 'DESKTOP_AUTOUPDATE', 'MULTI_WAREHOUSE', 'ONLINE_STORE', 'MULTI_STOREFRONT'],
  limits: { MAX_STOREFRONTS: 5 },
}

describe('comparePlans', () => {
  it('un passage à une offre plus large gagne des fonctions et des limites plus hautes, sans rien perdre', () => {
    const change = comparePlans(free, online)
    expect(change.gained).toEqual(['ONLINE_STORE'])
    expect(change.lost).toEqual([])
    expect(change.limits).toEqual([{ quota: 'MAX_PRODUCTS', from: 100, to: 500, worse: false }])
    expect(change.isDowngrade).toBe(false)
  })

  it('un retour à une offre plus petite perd des fonctions et baisse des limites', () => {
    const change = comparePlans(online, free)
    expect(change.lost).toEqual(['ONLINE_STORE'])
    expect(change.limits).toEqual([{ quota: 'MAX_PRODUCTS', from: 500, to: 100, worse: true }])
    expect(change.isDowngrade).toBe(true)
  })

  it('passer d\'une limite à « illimité » n\'est pas un recul, l\'inverse en est un', () => {
    const up = comparePlans(online, business)
    expect(up.limits).toContainEqual({ quota: 'MAX_PRODUCTS', from: 500, to: null, worse: false })
    expect(up.limits).toContainEqual({ quota: 'MAX_STOREFRONTS', from: 1, to: 5, worse: false })
    expect(up.limits).toContainEqual({ quota: 'MAX_ORDERS_PER_MONTH', from: 200, to: null, worse: false })
    expect(up.isDowngrade).toBe(false)
    const down = comparePlans(business, online)
    expect(down.limits).toContainEqual({ quota: 'MAX_PRODUCTS', from: null, to: 500, worse: true })
    expect(down.lost).toEqual(['MULTI_WAREHOUSE', 'MULTI_STOREFRONT'])
    expect(down.isDowngrade).toBe(true)
  })

  it('ne compare ni sites ni commandes en ligne quand la vente en ligne manque d\'un côté', () => {
    const change = comparePlans(free, online)
    expect(change.limits.map((l) => l.quota)).toEqual(['MAX_PRODUCTS'])
  })

  it('deux offres identiques ne changent rien', () => {
    const change = comparePlans(online, online)
    expect(change.hasChanges).toBe(false)
    expect(change.isDowngrade).toBe(false)
  })

  it('une boutique aux droits hérités (sans offre) se compare comme les autres', () => {
    const legacy = { features: ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING'], limits: {} }
    const change = comparePlans(legacy, free)
    expect(change.gained).toEqual(['DESKTOP_AUTOUPDATE'])
    expect(change.limits).toEqual([{ quota: 'MAX_PRODUCTS', from: null, to: 100, worse: true }])
    expect(change.isDowngrade).toBe(true)
  })
})

describe('displayedLimits', () => {
  it('cache sites et commandes quand l\'offre n\'a pas la vente en ligne', () => {
    expect(displayedLimits(free).map((l) => l.quota)).toEqual(['MAX_PRODUCTS', 'MAX_DEPOTS'])
    expect(displayedLimits(online).map((l) => l.quota)).toEqual(['MAX_PRODUCTS', 'MAX_STOREFRONTS', 'MAX_ORDERS_PER_MONTH', 'MAX_DEPOTS'])
  })

  it('une limite absente est illimitée', () => {
    expect(displayedLimits(business).find((l) => l.quota === 'MAX_PRODUCTS')?.value).toBeNull()
    expect(displayedLimits(online).find((l) => l.quota === 'MAX_STOREFRONTS')?.value).toBe(1)
  })
})
