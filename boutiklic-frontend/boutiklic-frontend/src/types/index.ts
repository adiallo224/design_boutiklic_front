export interface Product {
  id: string
  name: string
  barcode?: string
  category: string
  /** Id de la catégorie (categoryName ci-dessus est déjà résolu pour l'affichage) — nécessaire
   *  pour cibler les promotions par catégorie, cf. lib/promotionPricing.ts. */
  categoryId?: string
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrl?: string
  /** Galerie ordonnée, imageUrls[0] = couverture (= imageUrl ci-dessus) — cf. plan images multiples. */
  imageUrls: string[]
  /** Catégorie fiscale (module tax) — absent = taux par défaut du tenant, résolu à la vente. */
  taxCategoryId?: string
  /** Conditionnement d'achat : unités par lot et prix d'un lot — absents = achat à l'unité. Vont ensemble.
   *  Toute mise à jour d'article REMPLACE le conditionnement côté serveur : un écran qui renvoie l'article
   *  sans ces deux champs efface le lot (cf. ProductSheetModalDesktop). */
  packSize?: number
  packPurchasePrice?: number
  /** Coût unitaire exact stocké par le serveur (6 décimales) — peut différer du lot et du prix d'achat arrondi (méthode de coût de
   *  la boutique). À lire via effectiveUnitCost, jamais à recalculer depuis le lot. */
  unitCost?: number
  quantity: number
  alertThreshold: number
  isFavorite: boolean
  isActive: boolean
}

export interface SaleLine {
  id: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
  barcode?: string
  /** Promotion appliquée à cette ligne au moment de l'ajout au panier (résolution côté frontend). */
  promotionId?: string
  /** Prix catalogue avant promotion — absent si aucune promotion n'était applicable. */
  catalogPrice?: number
  /** Catégorie fiscale du produit (Product.taxCategoryId) — résolue côté panier local, transmise
   *  à l'ajout de ligne ; la caisse ne stocke pas le taux, seulement l'id (résolu côté backend). */
  taxCategoryId?: string
}

