import { productsApi, type ProductResponse } from './productsApi'
import { categoriesApi, type CategoryResponse } from './categoriesApi'
import { inventoryApi, type StockLineResponse } from './inventoryApi'
import { NetworkError } from './apiClient'
import { getLocalCatalog } from './dexie/catalogSync'
import { cacheStock, getCachedStock } from './stockCache'
import type { Product } from '../types'
import i18n from '../i18n'

/** Assemble le catalogue affichable (nom/prix du module product_catalog + quantité/seuil du
 *  module inventory, deux contextes bornés distincts côté backend) — utilisé par StockFlow,
 *  CashierFlow et DesktopStock, qui ont tous besoin de cette vue combinée.
 *
 *  Hors ligne (NetworkError seulement — une erreur métier reste une vraie erreur, cf. apiClient) :
 *  repli sur la réplique Dexie (catalogue, tenue à jour en continu par le SyncEngine) et le dernier
 *  instantané de stock connu (cf. lib/stockCache.ts) — jamais recalculé localement, juste affiché
 *  tel quel avec son horodatage (cf. règle non-négociable du plan offline-first). */
export async function loadCatalogWithStock(): Promise<{ products: Product[]; categories: CategoryResponse[]; stockAsOf: string | null }> {
  try {
    const [productList, categoryList, stockLines] = await Promise.all([
      productsApi.search(),
      categoriesApi.getAll(),
      inventoryApi.getOverview('all'),
    ])
    cacheStock(stockLines)
    return { products: assemble(productList, categoryList, stockLines), categories: categoryList, stockAsOf: null }
  } catch (error) {
    if (!(error instanceof NetworkError)) throw error
    const [productList, categoryList] = await Promise.all([
      getLocalCatalog(),
      categoriesApi.getAll().catch(() => [] as CategoryResponse[]),
    ])
    const { lines: stockLines, asOf } = getCachedStock()
    return { products: assemble(productList, categoryList, stockLines), categories: categoryList, stockAsOf: asOf }
  }
}

function assemble(productList: ProductResponse[], categoryList: CategoryResponse[], stockLines: StockLineResponse[]): Product[] {
  const categoryNameById = new Map(categoryList.map((c) => [c.id, c.name]))
  const stockByProductId = new Map(stockLines.map((s) => [s.productId, s]))

  return productList.map((p): Product => {
    const stock = stockByProductId.get(p.id)
    return {
      id: p.id,
      name: p.name,
      barcode: p.barcode ?? undefined,
      category: (p.categoryId && categoryNameById.get(p.categoryId)) || i18n.t('common.noCategory'),
      categoryId: p.categoryId ?? undefined,
      purchasePrice: p.purchasePrice,
      salePrice: p.salePrice,
      currency: p.currency,
      imageUrl: p.imageUrl ?? undefined,
      imageUrls: p.imageUrls ?? [],
      taxCategoryId: p.taxCategoryId ?? undefined,
      packSize: p.packSize ?? undefined,
      packPurchasePrice: p.packPurchasePrice ?? undefined,
      unitCost: p.unitCost,
      quantity: stock?.quantity ?? 0,
      alertThreshold: stock?.alertThreshold ?? 0,
      isFavorite: p.favorite,
      isActive: p.active,
    }
  })
}
