jest.mock('./productsApi', () => ({ productsApi: { search: jest.fn() } }))
jest.mock('./categoriesApi', () => ({ categoriesApi: { getAll: jest.fn() } }))
jest.mock('./inventoryApi', () => ({ inventoryApi: { getOverview: jest.fn() } }))
jest.mock('./apiClient', () => {
  class NetworkError extends Error {}
  return { NetworkError }
})
jest.mock('./watermelon/catalogSync', () => ({ getLocalCatalog: jest.fn() }))
jest.mock('./stockCache', () => ({
  cacheStock: jest.fn().mockResolvedValue(undefined),
  getCachedStock: jest.fn().mockResolvedValue({ lines: [], asOf: '2026-10-02T10:00:00Z' }),
}))
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (key: string) => key } }))

import { productsApi, type ProductResponse } from './productsApi'
import { categoriesApi } from './categoriesApi'
import { inventoryApi } from './inventoryApi'
import { NetworkError } from './apiClient'
import { getLocalCatalog } from './watermelon/catalogSync'
import { loadCatalogWithStock } from './productCatalog'

function response(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 'p1', name: 'Riz', barcode: null, categoryId: null, purchasePrice: 80000, salePrice: 100000, margin: 20000, currency: 'GNF',
    imageUrl: null, imageUrls: [], taxCategoryId: null, favorite: false, active: true, packSize: null, packPurchasePrice: null, unitCost: 80000,
    ...overrides,
  }
}

beforeEach(() => {
  ;(categoriesApi.getAll as jest.Mock).mockReset().mockResolvedValue([])
  ;(inventoryApi.getOverview as jest.Mock).mockReset().mockResolvedValue([])
  ;(productsApi.search as jest.Mock).mockReset()
  ;(getLocalCatalog as jest.Mock).mockReset()
})

/** La conversion réponse API → Product perdait la catégorie fiscale : la fiche article mobile la renvoyait donc absente à chaque
 *  mise à jour, et le serveur (qui remplace tout) remettait l'article sur « automatique ». */
describe('loadCatalogWithStock — catégorie fiscale (mobile)', () => {
  it('en ligne : la catégorie fiscale de l’article est conservée', async () => {
    ;(productsApi.search as jest.Mock).mockResolvedValue([response({ taxCategoryId: 'cat-standard' })])

    const { products } = await loadCatalogWithStock()

    expect(products[0].taxCategoryId).toBe('cat-standard')
  })

  it('en ligne : un article « automatique » (null côté serveur) n’a pas de catégorie fiscale', async () => {
    ;(productsApi.search as jest.Mock).mockResolvedValue([response({ taxCategoryId: null })])

    const { products } = await loadCatalogWithStock()

    expect(products[0].taxCategoryId).toBeUndefined()
  })

  it('hors ligne : le repli sur la réplique locale conserve lui aussi la catégorie fiscale', async () => {
    ;(productsApi.search as jest.Mock).mockRejectedValue(new NetworkError())
    ;(getLocalCatalog as jest.Mock).mockResolvedValue([response({ taxCategoryId: 'cat-exempt' })])

    const { products } = await loadCatalogWithStock()

    expect(products[0].taxCategoryId).toBe('cat-exempt')
  })

  it('le lot et la catégorie fiscale traversent ensemble la conversion', async () => {
    ;(productsApi.search as jest.Mock).mockResolvedValue([
      response({ taxCategoryId: 'cat-standard', packSize: 3, packPurchasePrice: 1000, purchasePrice: 333, unitCost: 333.333333 }),
    ])

    const { products } = await loadCatalogWithStock()

    expect(products[0]).toMatchObject({ taxCategoryId: 'cat-standard', packSize: 3, packPurchasePrice: 1000 })
  })

  it('le coût exact stocké par le serveur traverse la conversion, même quand il ne tient pas dans le prix d\'achat arrondi', async () => {
    ;(productsApi.search as jest.Mock).mockResolvedValue([response({ purchasePrice: 333, unitCost: 333.333333 })])

    const { products } = await loadCatalogWithStock()

    expect(products[0].unitCost).toBe(333.333333)
    expect(products[0].purchasePrice).toBe(333)
  })

  it('hors ligne : le repli sur la réplique locale conserve lui aussi le coût exact', async () => {
    ;(productsApi.search as jest.Mock).mockRejectedValue(new NetworkError())
    ;(getLocalCatalog as jest.Mock).mockResolvedValue([response({ purchasePrice: 333, unitCost: 333.333333 })])

    const { products } = await loadCatalogWithStock()

    expect(products[0].unitCost).toBe(333.333333)
  })
})
