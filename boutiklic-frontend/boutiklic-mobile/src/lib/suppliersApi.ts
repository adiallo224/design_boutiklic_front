import { apiClient } from './apiClient'

export interface SupplierResponse {
  id: string
  name: string
  phone: string | null
  location: string | null
  balanceDue: number
  currency: string
}

export interface SupplierTransactionResponse {
  id: string
  type: string
  amount: number
  note: string | null
  createdAt: string
}

export interface CreateSupplierRequest {
  name: string
  phone?: string
  location?: string
  currency: string
}

export interface PaySupplierRequest {
  amount: number
  currency: string
  note?: string
}

/** Client typé du module inventory/suppliers — cf. boutiklic-core SupplierController (écran C7). */
export const suppliersApi = {
  getAll: () => apiClient.get<SupplierResponse[]>('/suppliers'),

  getById: (supplierId: string) => apiClient.get<SupplierResponse>(`/suppliers/${supplierId}`),

  getTransactions: (supplierId: string) =>
    apiClient.get<SupplierTransactionResponse[]>(`/suppliers/${supplierId}/transactions`),

  create: (payload: CreateSupplierRequest) => apiClient.post<SupplierResponse>('/suppliers', payload),

  pay: (supplierId: string, payload: PaySupplierRequest) =>
    apiClient.post<SupplierResponse>(`/suppliers/${supplierId}/payments`, payload),
}
