import { apiClient } from './apiClient'

export interface ProductResponse {
  id: string
  name: string
  barcode: string | null
  categoryId: string | null
  purchasePrice: number
  salePrice: number
  margin: number
  currency: string
  imageUrl: string | null
  /** Galerie ordonnée, imageUrls[0] = couverture (= imageUrl ci-dessus) — cf. plan images multiples. */
  imageUrls: string[]
  /** Catégorie fiscale (module tax) — null = taux par défaut du tenant, résolu à la vente. */
  taxCategoryId: string | null
  favorite: boolean
  active: boolean
  /** Conditionnement d'achat (unités par lot / prix d'un lot) — null = achat à l'unité. */
  packSize: number | null
  packPurchasePrice: number | null
  /** Coût unitaire EXACT (6 décimales) : `purchasePrice` n'en est que l'arrondi à la devise. */
  unitCost: number
  /** Texte facultatif affiché sur la boutique en ligne; null si absent. */
  description?: string | null
}

export interface CreateProductRequest {
  name: string
  barcode?: string
  categoryId?: string
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrls?: string[]
  initialQuantity: number
  alertThreshold: number
  taxCategoryId?: string
  /** Les deux vont ensemble. Avec un lot, le serveur DÉRIVE `purchasePrice` (prix du lot / unités) et ignore
   *  celui envoyé. */
  packSize?: number
  packPurchasePrice?: number
}

/** Mise à jour = remplacement complet, conditionnement compris : sans `packSize` / `packPurchasePrice`, l'article
 *  repasse en achat à l'unité au `purchasePrice` fourni. Toujours renvoyer le lot existant. */
export interface UpdateProductRequest {
  name: string
  barcode?: string
  categoryId?: string
  purchasePrice: number
  salePrice: number
  currency: string
  imageUrls?: string[]
  taxCategoryId?: string
  packSize?: number
  packPurchasePrice?: number
}

export interface SearchProductsParams {
  query?: string
  categoryId?: string
  barcode?: string
}

/** Client typé du module product_catalog/products — cf. boutiklic-core ProductController (écrans B2, C1-C3). */
export const productsApi = {
  search: (params: SearchProductsParams = {}) => {
    const query = new URLSearchParams()
    if (params.query) query.set('query', params.query)
    if (params.categoryId) query.set('categoryId', params.categoryId)
    if (params.barcode) query.set('barcode', params.barcode)
    const qs = query.toString()
    return apiClient.get<ProductResponse[]>(`/products${qs ? `?${qs}` : ''}`)
  },

  getById: (productId: string) => apiClient.get<ProductResponse>(`/products/${productId}`),

  create: (payload: CreateProductRequest) => apiClient.post<ProductResponse>('/products', payload),

  update: (productId: string, payload: UpdateProductRequest) =>
    apiClient.patch<ProductResponse>(`/products/${productId}`, payload),

  /** Attribue un code-barres interne (EAN-13 « 20… ») à un article sans code — idempotent : un article qui en a
   *  déjà un le garde (cf. boutiklic-core AssignInternalBarcodeUseCase). Requiert le réseau : le numéro vient du
   *  compteur du serveur, jamais généré localement (deux appareils hors ligne pourraient produire le même). */
  assignInternalBarcode: (productId: string) => apiClient.post<ProductResponse>(`/products/${productId}/internal-barcode`, {}),

  /** Précision des prix de vente de la boutique (0 à 2 décimales) — propriétaire seulement. Échoue en 409 si l'on repasse à moins de
   *  décimales alors que des articles actifs ont encore un prix plus précis (le message donne leur nombre). Requiert le réseau. */
  changeSellingPriceDecimals: (decimals: number) =>
    apiClient.patch<{ sellingPriceDecimals: number }>('/products/pricing/selling-price-decimals', { decimals }),

  setFavorite: (productId: string, value: boolean) =>
    apiClient.patch<ProductResponse>(`/products/${productId}/favorite?value=${value}`),

  deactivate: (productId: string) =>
    apiClient.patch<ProductResponse>(`/products/${productId}/deactivate`),

  /** Définit la description de l'article (vide ou null = aucune, 2000 caractères au plus) sans renvoyer toute la fiche: la mise à jour classique est un remplacement complet
   *  qui ne connaît pas ce champ. */
  changeDescription: (productId: string, description: string | null) =>
    apiClient.patch<ProductResponse>(`/products/${productId}/description`, { description }),

  /** Reclasse l'article sans renvoyer la fiche (la mise à jour classique est un remplacement complet). `null` = « Non classés ». */
  changeCategory: (productId: string, categoryId: string | null) =>
    apiClient.patch<ProductResponse>(`/products/${productId}/category`, { categoryId }),
}
