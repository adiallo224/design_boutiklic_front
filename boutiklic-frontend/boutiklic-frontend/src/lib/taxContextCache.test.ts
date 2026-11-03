import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TaxContext } from '@boutiklic/shared'

vi.mock('./taxApi', () => ({ taxApi: { getActiveCategories: vi.fn() } }))

import { taxApi } from './taxApi'
import { cacheTaxContext, getCachedTaxContext, refreshTaxContext } from './taxContextCache'

const getActiveCategories = taxApi.getActiveCategories as unknown as ReturnType<typeof vi.fn>

const CONTEXT: TaxContext = {
  enabled: true,
  defaultTaxCategoryId: 'standard',
  taxCategories: [{ id: 'standard', name: 'Normale', ratePercent: 18 }],
  categories: [],
}

beforeEach(() => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  getActiveCategories.mockReset()
})

afterEach(() => vi.unstubAllGlobals())

describe('cache du contexte de TVA hors ligne', () => {
  it('relit ce qui a été mis en cache pour la même boutique', () => {
    cacheTaxContext('t1', CONTEXT)
    expect(getCachedTaxContext('t1')).toEqual(CONTEXT)
  })

  it("ne ressert jamais le taux d'une autre boutique", () => {
    cacheTaxContext('t1', CONTEXT)
    expect(getCachedTaxContext('t2')).toBeNull()
  })

  it('rien en cache : null', () => {
    expect(getCachedTaxContext('t1')).toBeNull()
  })

  it('refresh en ligne : construit le contexte depuis les taux, les catégories et la boutique, et le met en cache', async () => {
    getActiveCategories.mockResolvedValue([{ id: 'standard', name: 'Normale', active: true, ratePercent: 18 }])
    const context = await refreshTaxContext(
      { id: 't1', taxEnabled: true, defaultTaxCategoryId: 'standard' },
      [{ id: 'c1', name: 'Alim', color: '#000', icon: null, parentId: null, depth: 1, position: 0, taxCategoryId: 'standard' }],
    )
    expect(context?.categories).toEqual([{ id: 'c1', parentId: null, taxCategoryId: 'standard' }])
    expect(getCachedTaxContext('t1')).toEqual(context)
  })

  it("refresh hors ligne : l'instantané précédent est conservé", async () => {
    cacheTaxContext('t1', CONTEXT)
    getActiveCategories.mockRejectedValue(new Error('réseau'))
    const context = await refreshTaxContext({ id: 't1', taxEnabled: false, defaultTaxCategoryId: null }, [])
    expect(context).toEqual(CONTEXT)
    expect(getCachedTaxContext('t1')).toEqual(CONTEXT)
  })
})
