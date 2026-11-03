import { db, type LocalProduct } from './database'
import { syncEngine } from '../syncEngine'
import { productsApi, type ProductResponse } from '../productsApi'
import { currencyDecimals, effectiveUnitCost, roundHalfUp } from '@boutiklic/shared'

/**
 * Câblage du catalogue offline (cf. plan offline-first, Phase 4) sur le SyncEngine partagé (Phase 2).
 * Miroir exact de boutiklic-mobile/src/lib/watermelon/catalogSync.ts — cf. ce fichier pour le
 * raisonnement détaillé (pourquoi ProductCreatedEvent déclenche un refetch complet, pourquoi
 * ProductUpdatedEvent ne touche jamais favorite/active, etc.), non dupliqué ici.
 */

function toLocalProduct(product: ProductResponse, serverUpdatedAt: number): LocalProduct {
  return {
    id: product.id,
    name: product.name,
    barcode: product.barcode,
    categoryId: product.categoryId,
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    currency: product.currency,
    imageUrl: product.imageUrl,
    imageUrls: product.imageUrls,
    taxCategoryId: product.taxCategoryId,
    packSize: product.packSize ?? null,
    packPurchasePrice: product.packPurchasePrice ?? null,
    unitCost: product.unitCost ?? null,
    favorite: product.favorite,
    active: product.active,
    serverUpdatedAt,
  }
}

async function upsertCreate(product: ProductResponse, serverUpdatedAt: number) {
  const existing = await db.products.get(product.id)
  if (existing) return // déjà connu localement (ex. backfill initial déjà passé par là)
  await db.products.put(toLocalProduct(product, serverUpdatedAt))
}

interface UpdatedFields {
  productId: string
  name: string
  barcode: string | null
  categoryId: string | null
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrl: string | null
  imageUrls: string[]
  taxCategoryId: string | null
  /** Absents d'un événement émis avant la phase 2 (aucun lot n'existait alors) : traités comme null. */
  packSize?: number | null
  packPurchasePrice?: number | null
  /** Coût exact stocké (phase 7e) : absent d'un événement plus ancien, la lecture dérive alors du lot ou du prix d'achat. */
  unitCost?: number | null
}

/** Ne touche que les champs portés par ProductUpdatedEvent — jamais favorite/active, qu'il ne porte
 *  pas (sans ça, chaque changement de prix effacerait silencieusement le favori local). */
async function upsertUpdate(fields: UpdatedFields, serverUpdatedAt: number) {
  const existing = await db.products.get(fields.productId)
  if (!existing) {
    // Jamais vu localement (device qui n'a jamais pull la création) : on récupère le détail complet
    // plutôt que de créer une ligne avec favorite/active devinés.
    const product = await productsApi.getById(fields.productId)
    await upsertCreate(product, serverUpdatedAt)
    return
  }
  if (existing.serverUpdatedAt > serverUpdatedAt) return // déjà plus récent localement (LWW)
  await db.products.put({
    ...existing,
    name: fields.name,
    barcode: fields.barcode,
    categoryId: fields.categoryId,
    purchasePrice: fields.purchasePrice,
    salePrice: fields.salePrice,
    currency: fields.currency,
    imageUrl: fields.imageUrl,
    imageUrls: fields.imageUrls,
    taxCategoryId: fields.taxCategoryId,
    packSize: fields.packSize ?? null,
    packPurchasePrice: fields.packPurchasePrice ?? null,
    unitCost: fields.unitCost ?? null,
    serverUpdatedAt,
  })
}

interface ProductCreatedPayload {
  productId: string
}

/** À appeler une fois au démarrage de l'app, avant toute lecture du catalogue local. */
export function registerCatalogSyncHandlers() {
  syncEngine.registerChangeHandler('ProductCreatedEvent', async (entry) => {
    const payload = JSON.parse(entry.payload) as ProductCreatedPayload
    const product = await productsApi.getById(payload.productId)
    await upsertCreate(product, Date.parse(entry.occurredAt))
  })

  syncEngine.registerChangeHandler('ProductUpdatedEvent', async (entry) => {
    const payload = JSON.parse(entry.payload) as UpdatedFields
    await upsertUpdate(payload, Date.parse(entry.occurredAt))
  })
}

/** Amorce la réplique locale au premier lancement : change_log ne couvre que les changements
 *  survenus après le déploiement de la Phase 1, donc un catalogue déjà existant n'y apparaît pas.
 *  Sans effet si la table locale contient déjà des lignes. */
export async function backfillCatalogIfEmpty(): Promise<void> {
  const alreadySeeded = (await db.products.count()) > 0
  if (alreadySeeded) {
    await repairUnitCosts()
    return
  }

  const products = await productsApi.search()
  const now = Date.now()
  await db.products.bulkPut(products.map((p) => toLocalProduct(p, now)))
}

/**
 * Rattrapage après la v4 : les lignes déjà en cache n'ont pas de coût exact (null = « pas encore connu »). Sans lui, les marges et la
 * valeur du stock hors ligne seraient calculées depuis le lot ou le prix d'achat ARRONDI, donc fausses dès qu'une méthode de coût a
 * fixé un coût exact à l'arrivage. On complète ces lignes depuis le serveur dès qu'il répond, sans vider le catalogue (qui doit rester
 * disponible hors ligne). Ne touche qu'à unitCost : un changement local concurrent n'est jamais écrasé. Sans effet une fois tout
 * connu ; hors ligne, échoue sans bruit (l'appelant avale l'erreur) et se retente au prochain démarrage.
 */
async function repairUnitCosts(): Promise<void> {
  const missing = await db.products.filter((p) => p.unitCost == null).primaryKeys()
  if (missing.length === 0) return

  const products = await productsApi.search()
  const unitCostById = new Map(products.map((p) => [p.id, p.unitCost]))
  await db.transaction('rw', db.products, async () => {
    for (const id of missing) {
      const unitCost = unitCostById.get(id)
      if (typeof unitCost === 'number') await db.products.update(id, { unitCost })
    }
  })
}

/** Lecture locale — utilisée en repli hors-ligne par loadCatalogWithStock (cf. lib/productCatalog.ts). */
export async function getLocalCatalog(): Promise<ProductResponse[]> {
  const rows = await db.products.toArray()
  return rows
    .filter((r) => r.active)
    .map((r): ProductResponse => ({
      id: r.id,
      name: r.name,
      barcode: r.barcode,
      categoryId: r.categoryId,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      margin: roundHalfUp(r.salePrice - effectiveUnitCost(r), currencyDecimals(r.currency)),
      currency: r.currency,
      imageUrl: r.imageUrl,
      imageUrls: r.imageUrls,
      taxCategoryId: r.taxCategoryId,
      favorite: r.favorite,
      active: r.active,
      packSize: r.packSize,
      packPurchasePrice: r.packPurchasePrice,
      unitCost: effectiveUnitCost(r),
    }))
}
