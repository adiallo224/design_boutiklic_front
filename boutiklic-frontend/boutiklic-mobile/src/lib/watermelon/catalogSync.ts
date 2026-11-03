import { Q } from '@nozbe/watermelondb'
import { database } from './database'
import ProductModel from './models/ProductModel'
import { syncEngine } from '../syncEngine'
import { productsApi, type ProductResponse } from '../productsApi'
import { currencyDecimals, effectiveUnitCost, roundHalfUp } from '@boutiklic/shared'

/**
 * Câblage du catalogue offline (cf. plan offline-first, Phase 3) sur le SyncEngine partagé (Phase 2).
 *
 * ProductCreatedEvent ne porte que productId/tenantId/quantité initiale (conçu à l'origine pour
 * initialiser la ligne de stock côté inventory, cf. product_catalog.domain.event) — pas de quoi
 * peupler une ligne catalogue. On refetch donc le détail complet via l'API existante à la création ;
 * ProductUpdatedEvent en revanche porte tous les champs modifiables, aucun refetch nécessaire.
 */

const productsCollection = () => database.get<ProductModel>('products')

function applyKnownFields(record: ProductModel, fields: {
  name: string
  barcode: string | null
  categoryId: string | null
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrl: string | null
  imageUrls: string[]
  /** Catégorie fiscale : null/absente = « automatique » (taux par défaut de la boutique). */
  taxCategoryId?: string | null
  /** Absents d'un ProductUpdatedEvent émis avant la phase 2 (aucun lot n'existait alors) : traités comme null. */
  packSize?: number | null
  packPurchasePrice?: number | null
  /** Coût exact stocké (phase 7e) : absent d'un événement plus ancien — laissé NULL, le rattrapage le complète. */
  unitCost?: number | null
  serverUpdatedAt: number
}) {
  record.name = fields.name
  record.barcode = fields.barcode
  record.categoryId = fields.categoryId
  record.purchasePrice = fields.purchasePrice
  record.salePrice = fields.salePrice
  record.currency = fields.currency
  record.imageUrl = fields.imageUrl
  record.imageUrls = fields.imageUrls
  // '' et non null : null signifie « pas encore synchronisée » (cf. repairTaxCategories) ; ici la valeur est connue, « automatique » compris.
  record.taxCategoryId = fields.taxCategoryId ?? ''
  record.packSize = fields.packSize ?? null
  record.packPurchasePrice = fields.packPurchasePrice ?? null
  record.unitCost = fields.unitCost ?? null
  record.serverUpdatedAt = fields.serverUpdatedAt
}

/** Création (locale ou distante) : les champs favorite/active ne sont jamais connus à l'avance, on
 *  les fixe une seule fois ici (valeurs par défaut serveur) puis on ne les touche plus jamais au fil
 *  des ProductUpdatedEvent (qui ne les portent pas) — cf. upsertUpdate ci-dessous. */
async function upsertCreate(product: ProductResponse, serverUpdatedAt: number) {
  await database.write(async () => {
    const collection = productsCollection()
    try {
      await collection.find(product.id)
      // Déjà connu localement (ex. backfill initial déjà passé par là) : on ne recrée pas.
    } catch {
      await collection.create((r) => {
        r._raw.id = product.id
        applyKnownFields(r, {
          name: product.name, barcode: product.barcode, categoryId: product.categoryId,
          purchasePrice: product.purchasePrice, salePrice: product.salePrice, currency: product.currency,
          imageUrl: product.imageUrl, imageUrls: product.imageUrls,
          taxCategoryId: product.taxCategoryId,
          unitCost: product.unitCost,
          packSize: product.packSize, packPurchasePrice: product.packPurchasePrice, serverUpdatedAt,
        })
        r.favorite = product.favorite
        r.active = product.active
      })
    }
  })
}

/** Modification : ne touche que les champs portés par ProductUpdatedEvent — jamais favorite/active,
 *  qu'il ne porte pas (sans ça, chaque changement de prix effacerait silencieusement le favori local). */
async function upsertUpdate(
  fields: { productId: string; name: string; barcode: string | null; categoryId: string | null;
    purchasePrice: number; salePrice: number; currency: string; imageUrl: string | null; imageUrls: string[];
    taxCategoryId?: string | null; packSize?: number | null; packPurchasePrice?: number | null; unitCost?: number | null },
  serverUpdatedAt: number,
) {
  await database.write(async () => {
    const collection = productsCollection()
    try {
      const existing = await collection.find(fields.productId)
      if (existing.serverUpdatedAt > serverUpdatedAt) return // déjà plus récent localement (LWW)
      await existing.update((r) => applyKnownFields(r, { ...fields, serverUpdatedAt }))
    } catch {
      // Jamais vu localement (device qui n'a jamais pull la création) : on récupère le détail complet
      // plutôt que de créer une ligne avec favorite/active devinés.
      const product = await productsApi.getById(fields.productId)
      await upsertCreate(product, serverUpdatedAt)
    }
  })
}

interface ProductCreatedPayload {
  productId: string
}

interface ProductUpdatedPayload {
  productId: string
  name: string
  barcode: string | null
  categoryId: string | null
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrl: string | null
  imageUrls: string[]
  taxCategoryId?: string | null
  packSize?: number | null
  packPurchasePrice?: number | null
  unitCost?: number | null
}

/** À appeler une fois au démarrage de l'app, avant toute lecture du catalogue local. */
export function registerCatalogSyncHandlers() {
  syncEngine.registerChangeHandler('ProductCreatedEvent', async (entry) => {
    const payload = JSON.parse(entry.payload) as ProductCreatedPayload
    const product = await productsApi.getById(payload.productId)
    await upsertCreate(product, Date.parse(entry.occurredAt))
  })

  syncEngine.registerChangeHandler('ProductUpdatedEvent', async (entry) => {
    const payload = JSON.parse(entry.payload) as ProductUpdatedPayload
    await upsertUpdate(payload, Date.parse(entry.occurredAt))
  })
}

/** Amorce la réplique locale au premier lancement (ou après réinstallation) : change_log ne couvre
 *  que les changements survenus après le déploiement de la Phase 1, donc un catalogue déjà existant
 *  n'y apparaît pas. Sans effet si la table locale contient déjà des lignes. */
export async function backfillCatalogIfEmpty(): Promise<void> {
  const collection = productsCollection()
  const alreadySeeded = (await collection.query().fetchCount()) > 0
  if (alreadySeeded) {
    await repairMissingFields()
    return
  }

  const products = await productsApi.search()
  const now = Date.now()
  await database.write(async () => {
    await database.batch(
      ...products.map((product) =>
        collection.prepareCreate((r) => {
          r._raw.id = product.id
          applyKnownFields(r, {
            name: product.name, barcode: product.barcode, categoryId: product.categoryId,
            purchasePrice: product.purchasePrice, salePrice: product.salePrice, currency: product.currency,
            imageUrl: product.imageUrl, imageUrls: product.imageUrls,
            taxCategoryId: product.taxCategoryId,
            unitCost: product.unitCost,
            packSize: product.packSize, packPurchasePrice: product.packPurchasePrice, serverUpdatedAt: now,
          })
          r.favorite = product.favorite
          r.active = product.active
        }),
      ),
    )
  })
}

/**
 * Rattrapage après les migrations v4 (catégorie fiscale) et v5 (coût exact) : les lignes déjà en cache ont ces colonnes à NULL
 * (« pas encore synchronisée »). Sans la catégorie fiscale, modifier une photo depuis la réplique renverrait l'article SANS catégorie
 * fiscale, et comme une mise à jour REMPLACE tout côté serveur, l'article repasserait silencieusement sur « automatique ». Sans le
 * coût exact, les marges et la valeur du stock hors ligne partiraient du lot ou du prix d'achat ARRONDI, donc faux dès qu'une
 * méthode de coût a fixé un coût exact à l'arrivage. On complète ces lignes depuis le serveur dès qu'il répond, en une seule
 * lecture, sans vider le catalogue (qui doit rester disponible hors ligne) et sans toucher à une colonne déjà renseignée. Sans effet
 * une fois tout synchronisé ; hors ligne, échoue sans bruit et se retente au prochain démarrage.
 */
async function repairMissingFields(): Promise<void> {
  const collection = productsCollection()
  const unsynced = await collection
    .query(Q.or(Q.where('tax_category_id', null), Q.where('unit_cost', null)))
    .fetch()
  if (unsynced.length === 0) return

  const products = await productsApi.search()
  const serverById = new Map(products.map((p) => [p.id, p]))
  const updates = unsynced
    .filter((row) => serverById.has(row.id))
    .map((row) => row.prepareUpdate((r) => {
      const server = serverById.get(row.id)!
      if (r.taxCategoryId === null) r.taxCategoryId = server.taxCategoryId ?? ''
      if (r.unitCost === null || r.unitCost === undefined) r.unitCost = server.unitCost
    }))
  if (updates.length === 0) return
  await database.write(async () => {
    await database.batch(...updates)
  })
}

/** Lecture locale — utilisée en repli hors-ligne par loadCatalogWithStock (cf. lib/productCatalog.ts). */
export async function getLocalCatalog(): Promise<ProductResponse[]> {
  const rows = await productsCollection().query().fetch()
  return rows
    .filter((r) => r.active)
    .map((r) => ({
      id: r.id,
      name: r.name,
      barcode: r.barcode,
      categoryId: r.categoryId,
      purchasePrice: r.purchasePrice,
      salePrice: r.salePrice,
      margin: roundHalfUp(r.salePrice - effectiveUnitCost(r), currencyDecimals(r.currency)),
      currency: r.currency,
      imageUrl: r.imageUrl,
      imageUrls: r.imageUrls.length > 0 ? r.imageUrls : (r.imageUrl ? [r.imageUrl] : []),
      favorite: r.favorite,
      active: r.active,
      // '' (« automatique ») et NULL (pas encore synchronisée) valent null côté lecture ; le rattrapage complète les NULL.
      taxCategoryId: r.taxCategoryId ? r.taxCategoryId : null,
      packSize: r.packSize ?? null,
      packPurchasePrice: r.packPurchasePrice ?? null,
      unitCost: effectiveUnitCost(r),
    }))
}
