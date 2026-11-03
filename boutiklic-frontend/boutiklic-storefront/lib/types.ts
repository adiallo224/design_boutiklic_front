/**
 * Contrat de l'API PUBLIQUE de Boutiklic (module storefront / delivery / online_order). Ces types reprennent les DTO du core: aucune donnée interne (identifiant de boutique,
 * coût, stock exact...) n'y figure, parce que l'API publique ne les renvoie jamais.
 */
import type { Locale } from '@boutiklic/shared'

export interface PublicStorefront {
  name: string
  locale: Locale
  contactPhone: string | null
  contactWhatsapp: string | null
  contactEmail: string | null
  /** Absente si le core est plus ancien que la personnalisation des boutiques: la vitrine retombe alors sur l'apparence par défaut. */
  appearance?: PublicAppearance
}

export type TemplateCode = 'FASHION' | 'ELECTRONICS' | 'RESTAURANT' | 'LUXURY' | 'MINIMAL'
export type PageCode = 'HOME' | 'PRODUCTS' | 'PROMOTIONS' | 'CONTACT' | 'ABOUT' | 'FAQ' | 'BLOG' | 'TERMS' | 'PRIVACY' | 'RETURNS'
export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'TIKTOK' | 'WHATSAPP' | 'LINKEDIN' | 'YOUTUBE'

/** Apparence choisie par le commerçant. Les couleurs sont déjà complétées par celles du template ; `pages` ne contient que les pages ACTIVÉES, dans l'ordre. */
export interface PublicAppearance {
  template: TemplateCode
  description: string | null
  logoUrl: string | null
  faviconUrl: string | null
  bannerUrl: string | null
  theme: { primaryColor: string; secondaryColor: string; accentColor: string; buttonColor: string; textColor: string }
  seo: { title: string | null; description: string | null; keywords: string | null; imageUrl: string | null }
  pages: PageCode[]
  socialLinks: { platform: SocialPlatform; url: string }[]
}

/** Page optionnelle rédigée par le commerçant: texte brut, paragraphes séparés par une ligne vide. */
export interface PublicPage {
  code: PageCode
  body: string
}

export interface PublicProduct {
  id: string
  name: string
  description: string | null
  imageUrls: string[]
  /** Prix TTC affiché (prix en ligne, sinon prix du catalogue). */
  price: number
  /** Ancien prix barré, à titre indicatif seulement. */
  compareAtPrice: number | null
  currency: string
  categoryId: string | null
}

export interface ProductPage {
  items: PublicProduct[]
  page: number
  size: number
  total: number
}

export interface DeliveryZone {
  id: string
  name: string
  areas: string[]
  feeType: 'FLAT' | 'FREE_ABOVE' | 'TO_CONFIRM'
  fee: number | null
  freeAbove: number | null
  minOrder: number | null
  etaText: string | null
}

export interface PickupPoint {
  id: string
  name: string
  addressText: string
  latitude: number | null
  longitude: number | null
  hoursText: string | null
}

export interface DeliveryOptions {
  zones: DeliveryZone[]
  pickupPoints: PickupPoint[]
}

export type DeliveryMethod = 'DELIVERY' | 'PICKUP'

export interface QuoteRequest {
  items: { productId: string; quantity: number }[]
  deliveryMethod: DeliveryMethod
  area?: string
  pickupPointId?: string
}

export interface QuoteLine {
  productId: string
  name: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  lineTotal: number
  taxRatePercent: number | null
  lineTotalHt: number
  taxAmount: number
}

export interface QuoteDelivery {
  method: DeliveryMethod
  status: 'FEE' | 'FREE' | 'TO_CONFIRM' | 'PICKUP'
  fee: number | null
  zoneId: string | null
  zoneName: string | null
  etaText: string | null
  minOrder: number | null
  minOrderMet: boolean
  pickupPointId: string | null
}

export interface QuoteResponse {
  currency: string | null
  lines: QuoteLine[]
  unavailableProductIds: string[]
  subtotal: number
  taxTotal: number
  delivery: QuoteDelivery
  total: number
  /** Faux quand les frais de livraison sont « à confirmer » : le total ne les contient pas encore. */
  totalIsFinal: boolean
  canOrder: boolean
  issues: string[]
}

export interface PlaceOrderRequest extends QuoteRequest {
  addressText?: string
  landmark?: string
  buyerName: string
  buyerPhone: string
  buyerEmail?: string
  buyerNote?: string
  paymentMethod: 'COD' | 'PICKUP_PAYMENT'
  expectedTotal: number
  captchaToken?: string
}

export interface PlaceOrderResponse {
  orderNumber: string
  status: string
  paymentStatus: string
  currency: string
  subtotal: number
  deliveryFee: number | null
  deliveryFeeStatus: string
  total: number
  totalIsFinal: boolean
  trackingToken: string
}

export interface TrackedOrder {
  orderNumber: string
  status: 'PLACED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
  paymentStatus: string
  fulfillmentStatus: string
  deliveryMethod: DeliveryMethod
  currency: string
  subtotal: number
  deliveryFee: number | null
  total: number
  totalIsFinal: boolean
  canCancel: boolean
  placedAt: string
  lines: { name: string; imageUrl: string | null; unitPrice: number; quantity: number; lineTotal: number }[]
  timeline: { dimension: string; status: string; at: string }[]
}

/** Erreur RFC 7807 du core (champs utiles seulement). */
export interface ProblemDetail {
  status: number
  title?: string
  detail?: string
  errorCode?: string
  /** PRICE_CHANGED */
  newTotal?: number
  currency?: string
  /** ORDER_006 (stock) */
  productId?: string
  available?: number
}
