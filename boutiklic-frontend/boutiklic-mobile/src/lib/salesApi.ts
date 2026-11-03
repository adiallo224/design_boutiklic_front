import { apiClient } from './apiClient'
import { getActiveTenantId, getUserId } from './session'

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE' | 'DEBT'

/** Une tranche de paiement d'une vente (écran B3, paiement fractionné) — une par moyen de paiement utilisé. */
export interface PaymentSplit {
  method: PaymentMethod
  amount: number
}

export interface SaleLineResponse {
  id: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  lineTotal: number
  barcode: string | null
  promotionId: string | null
  catalogPrice: number | null
}

export interface SaleResponse {
  id: string
  tenantId: string
  cashierId: string
  lines: SaleLineResponse[]
  status: string
  paymentMethod: string | null
  payments: PaymentSplit[]
  totalAmount: number
  amountPaid: number
  changeDue: number
  debtId: string | null
  createdAt: string
  completedAt: string | null
}

export interface SaleCompletedResponse {
  saleId: string
  status: string
  totalAmount: number
  paymentMethod: string
  payments: PaymentSplit[]
  debtId: string | null
  message: string
}

export interface SaleDailySummaryResponse {
  totalSales: number
  totalRevenue: number
  totalCash: number
  totalMobileMoney: number
  totalDebt: number
  cancelledCount: number
  /** Remboursements enregistrés ce jour-là (date du retour), par mode. totalRevenue/totalCash restent bruts :
   *  espèces attendues en tiroir = totalCash - totalRefundedCash (avoir et réduction de dette ne sortent rien du tiroir). */
  totalRefundedCash: number
  totalRefundedCredit: number
  totalRefundedDebt: number
}

/** Remboursements d'une période par mode (GET /sales/refund-summary) — datés du jour du RETOUR. Seul `cash`
 *  sort physiquement du tiroir (l'avoir et la réduction de dette n'en font sortir aucun argent). */
export interface RefundSummaryResponse {
  cash: number
  credit: number
  debt: number
}

export interface SaleHistoryItemResponse {
  saleId: string
  cashierId: string
  totalAmount: number
  paymentMethod: string
  status: string
  createdAt: string
  itemCount: number
  cancelledBy: string | null
  /** Tranches de règlement — paymentMethod vaut MIXED dès qu'il y en a plusieurs ; c'est ici qu'on lit
   *  combien chaque mode a encaissé. Vide pour une vente non terminée. */
  payments: PaymentSplit[]
}

export interface AddLineRequest {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  currency: string
  barcode?: string
  /** Promotion résolue côté frontend au moment de l'ajout au panier, cf. lib/promotionPricing.ts. */
  promotionId?: string
  catalogPrice?: number
}

export interface CompleteSaleRequest {
  payments: PaymentSplit[]
  currency: string
  debtCustomerName?: string
  debtCustomerPhone?: string
}

export interface RecordCashCountRequest {
  /** ISO 8601 (date) — par défaut : aujourd'hui, côté backend. */
  periodDate?: string
  countedAmount: number
  currency: string
  note?: string
}

export interface CashCountResponse {
  id: string
  tenantId: string
  periodDate: string
  countedAmount: number
  currency: string
  countedBy: string
  note: string | null
  createdAt: string
  updatedAt: string
}

export type RefundMethod = 'CASH' | 'CREDIT' | 'DEBT'

export interface ReturnLineRequest {
  saleLineId: string
  /** Remise en stock configurable par ligne (ex: "Produit abîmé" -> décoché) — pas systématique. */
  restock: boolean
}

export interface CreateSaleReturnRequest {
  reason: string
  refundMethod: RefundMethod
  lines: ReturnLineRequest[]
  /** Requis seulement si refundMethod === 'CREDIT' — une vente CASH ne capture aucune identité client. */
  customerName?: string
  customerPhone?: string
}

export interface SaleReturnLineResponse {
  saleLineId: string
  productId: string
  productName: string
  quantity: number
  lineAmount: number
  restock: boolean
}

export interface SaleReturnResponse {
  id: string
  saleId: string
  reason: string
  refundMethod: RefundMethod
  refundAmount: number
  currency: string
  customerName: string | null
  customerPhone: string | null
  lines: SaleReturnLineResponse[]
  createdBy: string
  createdAt: string
}

/** Client typé du module sale/caisse — cf. boutiklic-core SaleController (écrans B1-B6). */
export const salesApi = {
  /** Crée une vente brouillon pour la boutique et le caissier courants (session active). */
  createSale: async (currency: string) => {
    const [tenantId, cashierId] = await Promise.all([getActiveTenantId(), getUserId()])
    return apiClient.post<SaleResponse>('/sales', { tenantId, cashierId, currency })
  },

  addLine: (saleId: string, payload: AddLineRequest) =>
    apiClient.post<SaleResponse>(`/sales/${saleId}/lines`, payload),

  complete: (saleId: string, payload: CompleteSaleRequest) =>
    apiClient.post<SaleCompletedResponse>(`/sales/${saleId}/complete`, payload),

  cancel: (saleId: string, reason: string) =>
    apiClient.post<void>(`/sales/${saleId}/cancel`, { reason }),

  /** Comptage physique de caisse (écran E1, bouton "Compter la caisse") — un second appel le même
   * jour met à jour le comptage précédent plutôt que d'en créer un autre. */
  recordCashCount: (payload: RecordCashCountRequest) =>
    apiClient.post<CashCountResponse>('/sales/cash-counts', payload),

  /** Retour d'articles sur une vente terminée (écran B5). */
  processReturn: (saleId: string, payload: CreateSaleReturnRequest) =>
    apiClient.post<SaleReturnResponse>(`/sales/${saleId}/returns`, payload),

  getById: (saleId: string) => apiClient.get<SaleResponse>(`/sales/${saleId}`),

  getDailySummary: () => apiClient.get<SaleDailySummaryResponse>('/sales/daily-summary'),

  /** @param from,to ISO 8601 (Instant) — par défaut : aujourd'hui, côté backend. */
  getRefundSummary: (from?: string, to?: string) => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    const qs = query.toString()
    return apiClient.get<RefundSummaryResponse>(`/sales/refund-summary${qs ? `?${qs}` : ''}`)
  },

  /** @param from,to ISO 8601 (Instant) — par défaut : aujourd'hui, côté backend. */
  getHistory: (from?: string, to?: string) => {
    const query = new URLSearchParams()
    if (from) query.set('from', from)
    if (to) query.set('to', to)
    const qs = query.toString()
    return apiClient.get<SaleHistoryItemResponse[]>(`/sales/history${qs ? `?${qs}` : ''}`)
  },
}
