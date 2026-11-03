import Dexie, { type Table } from 'dexie'

/**
 * Réplique locale offline-first web (cf. plan offline-first, Phase 4 : IndexedDB + Dexie, même
 * SyncEngine que le mobile). Miroir de boutiklic-mobile/src/lib/watermelon — mêmes règles :
 * catalogue seul est répliqué (le stock reste un instantané en lecture seule, cf. lib/stockCache.ts).
 *
 * Pas de tenant_id : comme côté mobile, cette base locale suit le choix déjà fait par l'outbox
 * existant (lib/outbox.ts), qui n'est pas non plus scopé par tenant.
 */
export interface LocalProduct {
  id: string
  name: string
  barcode: string | null
  categoryId: string | null
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrl: string | null
  /** Galerie ordonnée, imageUrls[0] = couverture (= imageUrl ci-dessus) — cf. plan images multiples. */
  imageUrls: string[]
  taxCategoryId: string | null
  /** Conditionnement d'achat (unités par lot / prix d'un lot) — null = achat à l'unité. Indispensable dans la
   *  réplique : la fiche produit renvoie tous les champs à l'enregistrement, et une mise à jour REMPLACE le
   *  conditionnement côté serveur — sans ces champs, modifier un article effacerait son lot. */
  packSize: number | null
  packPurchasePrice: number | null
  /** Coût unitaire exact (6 décimales) tel que stocké par le serveur — null = pas encore connu (ligne antérieure à la v4 ou
   *  événement ancien) : la lecture dérive alors du lot ou du prix d'achat, et catalogSync.repairUnitCosts le complète. */
  unitCost: number | null
  favorite: boolean
  active: boolean
  /** Timestamp serveur (epoch ms) — cf. catalogSync.ts, comparé au pull suivant pour ignorer un
   *  changement déjà appliqué localement (LWW, cf. plan : "catalogue = cache donc LWW acceptable"). */
  serverUpdatedAt: number
}

class BoutiklicDatabase extends Dexie {
  products!: Table<LocalProduct, string>

  constructor() {
    super('boutiklic')
    this.version(1).stores({
      products: 'id',
    })
    // v2 : galerie d'images (cf. plan images multiples §3). Aucun changement d'index — seule la
    // migration des lignes déjà en cache (imageUrl seul) vers imageUrls est nécessaire.
    this.version(2).stores({
      products: 'id',
    }).upgrade((tx) =>
      tx.table<LocalProduct, string>('products').toCollection().modify((p) => {
        p.imageUrls = p.imageUrl ? [p.imageUrl] : []
      })
    )
    // v3 : conditionnement d'achat (étude prix décimaux, phase 2). Aucun changement d'index. Les lignes déjà en
    // cache n'ont pas de lot : aucun lot n'existait avant cette version, donc null (achat à l'unité) est exact.
    this.version(3).stores({
      products: 'id',
    }).upgrade((tx) =>
      tx.table<LocalProduct, string>('products').toCollection().modify((p) => {
        p.packSize = null
        p.packPurchasePrice = null
      })
    )
    // v4 : coût unitaire exact (étude prix décimaux, phase 7e). Aucun changement d'index. Les lignes déjà en cache restent à null
    // (« pas encore connu ») et sont complétées depuis le serveur au prochain démarrage en ligne.
    this.version(4).stores({
      products: 'id',
    }).upgrade((tx) =>
      tx.table<LocalProduct, string>('products').toCollection().modify((p) => {
        p.unitCost = null
      })
    )
  }
}

export const db = new BoutiklicDatabase()
