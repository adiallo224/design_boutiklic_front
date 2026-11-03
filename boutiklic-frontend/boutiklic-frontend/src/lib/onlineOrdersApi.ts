import { apiClient } from './apiClient'

export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED'
export type PaymentStatus = 'UNPAID' | 'PENDING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'PARTIALLY_REFUNDED' | 'REFUNDED'
export type FulfillmentStatus = 'UNFULFILLED' | 'PREPARING' | 'READY_FOR_PICKUP' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'PICKED_UP' | 'DELIVERY_FAILED' | 'RETURNED'
export type StockStatus = 'RESERVED' | 'CONSUMED' | 'RELEASED' | 'CONFLICT'
export type DeliveryMethod = 'PICKUP' | 'DELIVERY'
export type RiskFlag = 'NEW_CUSTOMER' | 'MULTIPLE_OPEN_ORDERS' | 'IP_BURST' | 'LARGE_COD_FIRST_ORDER'

export interface OrderSummary {
  id: string
  orderNumber: string
  storefrontId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  stockStatus: StockStatus
  total: number
  currency: string
  buyerName: string
  buyerPhone: string
  deliveryMethod: DeliveryMethod
  placedAt: string
}

export interface OrderPage {
  items: OrderSummary[]
  page: number
  size: number
  total: number
}

export interface OrderLine {
  productId: string
  productName: string
  imageUrl: string | null
  unitPrice: number
  quantity: number
  /** Nul = aucune TVA applicable. */
  taxRatePercent: number | null
  lineTotalHt: number
  taxAmount: number
  lineTotal: number
}

export interface OrderHistoryEntry {
  dimension: 'ORDER' | 'PAYMENT' | 'FULFILLMENT' | 'STOCK'
  from: string | null
  to: string
  actor: string
  reason: string | null
  at: string
}

export interface OrderDetail {
  id: string
  orderNumber: string
  storefrontId: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  stockStatus: StockStatus
  currency: string
  subtotal: number
  /** Nul = frais « à confirmer » (communiqués par téléphone). */
  deliveryFee: number | null
  taxTotal: number
  total: number
  /** Faux quand les frais sont à confirmer: le total ne les contient pas encore. */
  totalIsFinal: boolean
  deliveryMethod: DeliveryMethod
  deliveryZoneId: string | null
  pickupPointId: string | null
  deliveryArea: string | null
  deliveryAddressText: string | null
  deliveryLandmark: string | null
  paymentMethod: string | null
  buyerName: string
  buyerPhone: string
  buyerEmail: string | null
  buyerNote: string | null
  /** Identifiant de la vente créée à la clôture. */
  saleId: string | null
  placedAt: string
  confirmedAt: string | null
  completedAt: string | null
  cancelledAt: string | null
  cancelReason: string | null
  handedOverAt: string | null
  lines: OrderLine[]
  history: OrderHistoryEntry[]
  /** 0 à 100, posé par l'anti-abus à la création. */
  riskScore: number
  riskFlags: RiskFlag[]
}

export interface BlocklistEntry {
  id: string
  kind: 'PHONE' | 'IP_HASH'
  value: string
  reason: string | null
  createdBy: string
  createdAt: string
}

export interface OrderFilter {
  status?: OrderStatus
  paymentStatus?: PaymentStatus
  fulfillmentStatus?: FulfillmentStatus
  storefrontId?: string
  page?: number
  size?: number
}

/** Actions de traitement d'une commande (une par route du serveur). */
export type OrderAction = 'confirm' | 'prepare' | 'ready' | 'ship' | 'hand-over' | 'deliver' | 'fail-delivery' | 'cancel' | 'mark-paid' | 'complete'

const base = (id: string) => `/online-orders/${encodeURIComponent(id)}`

/** Codes d'erreur du core que l'écran traite à part. */
export const ORDER_ERROR = { transition: 'ORDER_002', notFound: 'ORDER_008', forbidden: 'ORDER_403' } as const

/** Client typé des commandes en ligne côté vendeur — cf. boutiklic-core OnlineOrderController. */
export const onlineOrdersApi = {
  list: (filter: OrderFilter = {}) => {
    const query = new URLSearchParams()
    if (filter.status) query.set('status', filter.status)
    if (filter.paymentStatus) query.set('paymentStatus', filter.paymentStatus)
    if (filter.fulfillmentStatus) query.set('fulfillmentStatus', filter.fulfillmentStatus)
    if (filter.storefrontId) query.set('storefrontId', filter.storefrontId)
    query.set('page', String(filter.page ?? 0))
    query.set('size', String(filter.size ?? 20))
    return apiClient.get<OrderPage>(`/online-orders?${query.toString()}`)
  },
  get: (id: string) => apiClient.get<OrderDetail>(base(id)),

  /** Une action = une transition valide du serveur, avec ses effets sur le stock réel dans la même transaction. Renvoie la commande à jour. */
  act: (id: string, action: OrderAction, reason?: string) => apiClient.post<OrderDetail>(`${base(id)}/${action}`, reason ? { reason } : {}),

  /** Refuse désormais les commandes du téléphone (et de la connexion, si connue) de l'acheteur de cette commande. */
  blockBuyer: (id: string, reason?: string) => apiClient.post<{ blocked: number }>(`${base(id)}/block-buyer`, reason ? { reason } : {}),
  blocklist: () => apiClient.get<BlocklistEntry[]>('/online-orders/blocklist'),
  unblock: (entryId: string) => apiClient.delete<void>(`/online-orders/blocklist/${encodeURIComponent(entryId)}`),
}
