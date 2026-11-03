import { apiClient } from './apiClient'

export type StorefrontStatus = 'DRAFT' | 'PUBLISHED' | 'SUSPENDED' | 'ARCHIVED'
export type StorefrontLocale = 'fr' | 'en' | 'pt'
/** Ce qui empêche encore de publier un site (liste vide = publiable). */
export type PublicationBlocker = 'CONTACT_REQUIRED' | 'PRODUCT_REQUIRED'

export interface StorefrontDomain {
  hostname: string
  kind: 'SUBDOMAIN' | 'CUSTOM'
  status: 'PENDING' | 'VERIFIED' | 'ACTIVE' | 'FAILED' | 'REMOVED'
  primary: boolean
}

export interface StorefrontResponse {
  id: string
  slug: string
  name: string
  status: StorefrontStatus
  locale: StorefrontLocale
  contactPhone: string | null
  contactWhatsapp: string | null
  contactEmail: string | null
  publishedAt: string | null
  createdAt: string
  domains: StorefrontDomain[]
  publicationBlockers: PublicationBlocker[]
}

export interface CreateStorefrontRequest {
  slug: string
  name: string
  locale?: StorefrontLocale
  contactPhone?: string
  contactWhatsapp?: string
  contactEmail?: string
}

/** L'adresse (slug) ne change jamais après création : elle n'est donc pas dans la mise à jour. */
export interface UpdateStorefrontRequest {
  name: string
  locale?: StorefrontLocale
  contactPhone?: string
  contactWhatsapp?: string
  contactEmail?: string
}

export interface SlugAvailabilityResponse {
  slug: string
  available: boolean
  /** null si disponible. */
  reason: 'INVALID' | 'RESERVED' | 'TAKEN' | null
  /** Nom d'hôte que donnerait cette adresse. */
  hostname: string | null
}

export interface StorefrontProductResponse {
  productId: string
  name: string
  imageUrl: string | null
  catalogPrice: number
  /** null = prix du catalogue. */
  onlinePrice: number | null
  compareAtPrice: number | null
  /** Ce que la vitrine affiche. */
  effectivePrice: number
  currency: string
  position: number
  /** Faux = désactivé dans le catalogue : listé ici pour le commerçant mais invisible sur la vitrine. */
  active: boolean
}

export interface ProductPublicationItem {
  productId: string
  /** Absent = prix du catalogue. */
  onlinePrice?: number | null
  compareAtPrice?: number | null
  position?: number
}

// ---- Apparence (template, thème, identité visuelle, pages, réseaux sociaux, SEO) — cf. boutiklic-core StorefrontAppearanceController

export type TemplateCode = 'FASHION' | 'ELECTRONICS' | 'RESTAURANT' | 'LUXURY' | 'MINIMAL'
export type PageCode = 'HOME' | 'PRODUCTS' | 'PROMOTIONS' | 'CONTACT' | 'ABOUT' | 'FAQ' | 'BLOG' | 'TERMS' | 'PRIVACY' | 'RETURNS'
export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'WHATSAPP' | 'LINKEDIN' | 'YOUTUBE'

export const TEMPLATE_CODES: TemplateCode[] = ['FASHION', 'ELECTRONICS', 'RESTAURANT', 'LUXURY', 'MINIMAL']
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'LINKEDIN', 'YOUTUBE']

export interface ThemeColors {
  primaryColor: string | null
  secondaryColor: string | null
  accentColor: string | null
  buttonColor: string | null
  textColor: string | null
}

export interface AppearancePage {
  code: PageCode
  enabled: boolean
  position: number
  /** Accueil et Produits ne peuvent pas être masqués. */
  mandatory: boolean
}

export interface AppearanceResponse {
  templateCode: TemplateCode
  description: string | null
  logoUrl: string | null
  faviconUrl: string | null
  bannerUrl: string | null
  /** Couleurs réellement appliquées (choisies + celles du template). */
  theme: ThemeColors
  /** Couleurs choisies par le commerçant (null = celle du template). */
  customTheme: ThemeColors
  seo: { title: string | null; description: string | null; keywords: string | null; imageUrl: string | null }
  pages: AppearancePage[]
  socialLinks: { platform: SocialPlatform; url: string }[]
}

export interface TemplateResponse {
  code: TemplateCode
  name: string
  description: string
  defaultTheme: ThemeColors
}

/** Client typé de l'administration des sites e-commerce — cf. boutiklic-core StorefrontController et StorefrontProductController. */
export const storefrontsApi = {
  list: () => apiClient.get<StorefrontResponse[]>('/storefronts'),
  get: (id: string) => apiClient.get<StorefrontResponse>(`/storefronts/${encodeURIComponent(id)}`),
  create: (payload: CreateStorefrontRequest) => apiClient.post<StorefrontResponse>('/storefronts', payload),
  update: (id: string, payload: UpdateStorefrontRequest) => apiClient.patch<StorefrontResponse>(`/storefronts/${encodeURIComponent(id)}`, payload),
  publish: (id: string) => apiClient.post<StorefrontResponse>(`/storefronts/${encodeURIComponent(id)}/publish`),
  unpublish: (id: string) => apiClient.post<StorefrontResponse>(`/storefronts/${encodeURIComponent(id)}/unpublish`),
  /** Archive définitivement le site ; son adresse reste réservée. */
  archive: (id: string) => apiClient.delete<void>(`/storefronts/${encodeURIComponent(id)}`),
  checkSlug: (slug: string) => apiClient.get<SlugAvailabilityResponse>(`/storefronts/slug-availability?slug=${encodeURIComponent(slug)}`),

  listProducts: (id: string) => apiClient.get<StorefrontProductResponse[]>(`/storefronts/${encodeURIComponent(id)}/products`),
  /** Publie ou met à jour ces articles, tout ou rien (500 au plus par appel). */
  publishProducts: (id: string, items: ProductPublicationItem[]) =>
    apiClient.put<{ created: number; updated: number }>(`/storefronts/${encodeURIComponent(id)}/products`, { items }),
  /** Publie tous les articles actifs (d'une catégorie si indiquée) qui ne le sont pas encore. */
  publishAllProducts: (id: string, categoryId?: string) =>
    apiClient.post<{ created: number; updated: number }>(`/storefronts/${encodeURIComponent(id)}/products/publish-all`, categoryId ? { categoryId } : {}),
  unpublishProducts: (id: string, productIds: string[]) =>
    apiClient.post<{ removed: number }>(`/storefronts/${encodeURIComponent(id)}/products/unpublish`, { productIds }),

  /** Textes rédigés des pages optionnelles, par code de page (les pages sans texte sont absentes). */
  getPageContents: (id: string) => apiClient.get<{ contents: Partial<Record<PageCode, string>> }>(`/storefronts/${encodeURIComponent(id)}/page-contents`),
  /** Texte brut, paragraphes séparés par une ligne vide. Un texte vide supprime le contenu (la page disparaît du menu de la vitrine). */
  savePageContent: (id: string, code: PageCode, body: string) =>
    apiClient.put<void>(`/storefronts/${encodeURIComponent(id)}/page-contents/${code}`, { body }),

  listTemplates: () => apiClient.get<TemplateResponse[]>('/storefront-templates'),
  getAppearance: (id: string) => apiClient.get<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/appearance`),
  changeTemplate: (id: string, templateCode: TemplateCode) =>
    apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/template`, { templateCode }),
  /** Une couleur null/vide reprend celle du template. */
  updateTheme: (id: string, theme: ThemeColors) => apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/theme`, theme),
  resetTheme: (id: string) => apiClient.post<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/theme/reset`),
  /** Les images sont d'abord envoyées via fileApi.upload ; on ne transmet ici que leur adresse. */
  updateIdentity: (id: string, identity: { description: string | null; logoUrl: string | null; faviconUrl: string | null; bannerUrl: string | null }) =>
    apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/identity`, identity),
  /** L'ordre de la liste est l'ordre d'affichage. */
  updatePages: (id: string, pages: { code: PageCode; enabled: boolean }[]) =>
    apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/pages`, { pages }),
  updateSocialLinks: (id: string, links: { platform: SocialPlatform; url: string }[]) =>
    apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/social-links`, { links }),
  updateSeo: (id: string, seo: { title: string | null; description: string | null; keywords: string | null; imageUrl: string | null }) =>
    apiClient.put<AppearanceResponse>(`/storefronts/${encodeURIComponent(id)}/seo`, seo),
}

/** Codes d'erreur du core (RFC 7807) que l'écran traite à part. */
export const STOREFRONT_ERROR = {
  slugTaken: 'STOREFRONT_003',
  notIncluded: 'STOREFRONT_004',
} as const
