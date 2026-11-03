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
  /** Conditionnement d'achat : unités par lot et prix d'un lot — absents = achat à l'unité. Vont ensemble.
   *  Toute mise à jour d'article REMPLACE le conditionnement côté serveur : un écran qui renvoie l'article
   *  sans ces deux champs efface le lot (cf. ProductDetail). */
  packSize?: number
  packPurchasePrice?: number
  /** Coût unitaire exact stocké par le serveur (6 décimales) — peut différer du lot et du prix d'achat arrondi (méthode de coût de
   *  la boutique). À lire via effectiveUnitCost, jamais à recalculer depuis le lot. */
  unitCost?: number
  /** Catégorie fiscale (module tax) — absent = taux par défaut de la boutique, résolu à la vente. Toute mise à jour d'article REMPLACE la
   *  catégorie fiscale côté serveur : un écran qui renvoie l'article sans ce champ le remet sur « automatique » (cf. ProductDetail). */
  taxCategoryId?: string
  quantity: number
  alertThreshold: number
  /** Date du dernier réapprovisionnement connu (StockLineResponse.lastRestockAt) — nul si jamais
   *  réapprovisionné depuis la création du produit. Utilisé par l'écran Alertes de stock. */
  lastRestockAt: string | null
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
}

