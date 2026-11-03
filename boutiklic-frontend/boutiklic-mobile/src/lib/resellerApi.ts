import { apiClient } from './apiClient'

export type ResellerSort = 'late' | 'amount'

export interface ResellerResponse {
  resellerId: string
  name: string
  phone: string
  totalRemaining: number
  openConsignmentCount: number
  lastActivityAt: string
  urgency: string
  settled: boolean
}

export interface ResellersTotalResponse {
  totalOutstanding: number
  resellerCount: number
  openConsignmentCount: number
}

export interface CreateResellerRequest {
  name: string
  phone: string
  notes?: string
}

export interface CreateResellerResponse {
  resellerId: string
}

export interface ConsignmentLineRequest {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
}

export interface RecordConsignmentOutRequest {
  lines: ConsignmentLineRequest[]
  currency: string
}

export interface RecordConsignmentOutResponse {
  consignmentOutId: string
  totalOut: number
}

export interface RecordPaymentRequest {
  amount: number
  currency: string
  paymentMethod: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'
  note?: string
}

export interface PaymentResultResponse {
  totalRemainingAfter: number
}

export interface ReturnLineRequest {
  lineId: string
  quantity: number
}

export interface RecordReturnRequest {
  lines: ReturnLineRequest[]
  note?: string
}

export interface ReturnResultResponse {
  totalRemainingAfter: number
}

export interface ConsignmentLineDetailResponse {
  lineId: string
  productId: string
  productName: string
  unitPrice: number
  quantityOut: number
  quantityReturned: number
}

/** type: CONSIGNMENT_OUT (sortie, débit), PAYMENT (versement, crédit) ou RETURN (retour marchandise, crédit). */
export interface LedgerEntryResponse {
  type: 'CONSIGNMENT_OUT' | 'PAYMENT' | 'RETURN'
  consignmentOutId: string
  amount: number
  date: string
  note: string | null
  itemCount: number | null
  lines: ConsignmentLineDetailResponse[]
}

export interface ResellerLedgerResponse {
  resellerId: string
  name: string
  phone: string
  totalRemaining: number
  totalOut: number
  totalPaid: number
  entries: LedgerEntryResponse[]
}

/** Client typé du module reseller/dépôt-vente — cf. boutiklic-core ResellerController (écrans C8-C10). */
export const resellerApi = {
  getResellers: (sort: ResellerSort = 'late') => apiClient.get<ResellerResponse[]>(`/resellers?sort=${sort}`),

  getTotal: () => apiClient.get<ResellersTotalResponse>('/resellers/total'),

  getLedger: (phone: string) => apiClient.get<ResellerLedgerResponse>(`/resellers/${encodeURIComponent(phone)}/ledger`),

  create: (payload: CreateResellerRequest) => apiClient.post<CreateResellerResponse>('/resellers', payload),

  recordConsignmentOut: (phone: string, payload: RecordConsignmentOutRequest) =>
    apiClient.post<RecordConsignmentOutResponse>(`/resellers/${encodeURIComponent(phone)}/consignments`, payload),

  recordPayment: (phone: string, payload: RecordPaymentRequest) =>
    apiClient.post<PaymentResultResponse>(`/resellers/${encodeURIComponent(phone)}/payments`, payload),

  recordReturn: (phone: string, consignmentOutId: string, payload: RecordReturnRequest) =>
    apiClient.post<ReturnResultResponse>(
      `/resellers/${encodeURIComponent(phone)}/consignments/${consignmentOutId}/returns`,
      payload,
    ),
}
