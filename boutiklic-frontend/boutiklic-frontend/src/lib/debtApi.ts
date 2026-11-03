import { apiClient } from './apiClient'

export type DebtSort = 'urgency' | 'amount'

export interface DebtorResponse {
  customerName: string
  customerPhone: string
  totalRemaining: number
  nearestDueDate: string | null
  urgency: string
}

export interface DebtorsTotalResponse {
  totalOutstanding: number
  debtorCount: number
}

export interface LedgerEntryResponse {
  type: string
  amount: number
  date: string
  note: string | null
  saleId: string | null
  /** CREDIT_PURCHASE : id de la dette + échéance (dette manuelle modifiable si saleId est null). */
  debtId: string | null
  dueDate: string | null
  /** REPAYMENT : id du remboursement + moyen de paiement (permettent de le corriger). */
  paymentId: string | null
  paymentMethod: RecordPaymentRequest['paymentMethod'] | null
}

export interface DebtorDetailResponse {
  customerName: string
  customerPhone: string
  totalRemaining: number
  totalOriginal: number
  totalPaid: number
  percentPaid: number
  entries: LedgerEntryResponse[]
}

export interface RecordPaymentRequest {
  amount: number
  currency: string
  paymentMethod: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'
  note?: string
  notifyCustomer: boolean
}

export interface UpdatePaymentRequest {
  amount: number
  currency: string
  paymentMethod: RecordPaymentRequest['paymentMethod']
  note?: string | null
}

export interface UpdateManualDebtRequest {
  amount: number
  currency: string
  dueDate?: string | null
}

export interface PaymentResultResponse {
  totalRemainingAfter: number
}

export interface CreateDebtRequest {
  customerName: string
  customerPhone: string
  amount: number
  currency: string
  dueDate?: string
}

export interface CreateDebtResponse {
  debtId: string
}

export interface DebtHistoryEntryResponse {
  debtId: string
  customerName: string
  customerPhone: string
  totalAmount: number
  settledAt: string
  archived: boolean
}

/** Une dette précise (GET /debts/by-id/{debtId}) — status : ACTIVE | PAID | ARCHIVED | CANCELLED. */
export interface DebtResponse {
  debtId: string
  status: string
  totalAmount: number
  amountPaid: number
  remainingAmount: number
}

/** Client typé du module debt/carnet de dettes — cf. boutiklic-core DebtController (écrans D1-D3). */
export const debtApi = {
  getDebtors: (sort: DebtSort = 'urgency') => apiClient.get<DebtorResponse[]>(`/debts?sort=${sort}`),

  /** Une dette par son id (ex. Sale.debtId) — l'API des dettes est sinon indexée par téléphone client. */
  getDebtById: (debtId: string) => apiClient.get<DebtResponse>(`/debts/by-id/${encodeURIComponent(debtId)}`),

  getTotal: () => apiClient.get<DebtorsTotalResponse>('/debts/total'),

  getLedger: (customerPhone: string) =>
    apiClient.get<DebtorDetailResponse>(`/debts/${encodeURIComponent(customerPhone)}`),

  recordPayment: (customerPhone: string, payload: RecordPaymentRequest) =>
    apiClient.post<PaymentResultResponse>(`/debts/${encodeURIComponent(customerPhone)}/payments`, payload),

  updatePayment: (customerPhone: string, paymentId: string, payload: UpdatePaymentRequest) =>
    apiClient.put<PaymentResultResponse>(`/debts/${encodeURIComponent(customerPhone)}/payments/${encodeURIComponent(paymentId)}`, payload),

  updateManualDebt: (debtId: string, payload: UpdateManualDebtRequest) =>
    apiClient.put<PaymentResultResponse>(`/debts/by-id/${encodeURIComponent(debtId)}`, payload),

  createDebt: (payload: CreateDebtRequest) => apiClient.post<CreateDebtResponse>('/debts', payload),

  getHistory: () => apiClient.get<DebtHistoryEntryResponse[]>('/debts/history'),

  archiveDebt: (debtId: string) => apiClient.post<void>(`/debts/history/${encodeURIComponent(debtId)}/archive`),

  deleteDebt: (debtId: string) => apiClient.delete<void>(`/debts/history/${encodeURIComponent(debtId)}`),
}
