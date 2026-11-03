import { apiClient } from './apiClient'

/** Fonctionnalités que l'offre d'une boutique peut inclure — cf. boutiklic-core Feature (module subscription). */
export type Feature =
  | 'ONLINE_STORE'
  | 'POS'
  | 'INVENTORY_MANAGEMENT'
  | 'MULTI_STOREFRONT'
  | 'CUSTOM_DOMAIN'
  | 'MOBILE_MONEY'
  | 'ADVANCED_REPORTING'
  | 'MULTI_WAREHOUSE'
  | 'DESKTOP_AUTOUPDATE'

/** Limites chiffrées d'une offre — une clé absente de `limits` = illimité. */
export type Quota = 'MAX_STOREFRONTS' | 'MAX_PRODUCTS' | 'MAX_USERS' | 'MAX_DEPOTS' | 'MAX_ORDERS_PER_MONTH'

export interface Entitlements {
  features: Feature[]
  limits: Partial<Record<Quota, number>>
  /** LEGACY tant que l'abonnement de la boutique n'est pas migré vers les tables d'offres. */
  source: string
}

/** Droits de l'offre de la boutique courante — cf. boutiklic-core SubscriptionController. Sert à AFFICHER ou masquer les fonctions incluses ; le serveur reste seul juge (402). */
export const entitlementsApi = {
  get: () => apiClient.get<Entitlements>('/subscription/entitlements'),
}
