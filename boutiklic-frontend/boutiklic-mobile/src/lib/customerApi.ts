import { apiClient } from './apiClient'

export type CustomerType = 'PARTICULIER' | 'ENTREPRISE'

export interface CustomerResponse {
  id: string
  type: CustomerType
  name: string
  phone: string | null
  address: string | null
  taxId: string | null
  active: boolean
  /** Client exonéré de TVA : ses devis (et les ventes/factures qui en découlent) sortent sans TVA. */
  taxExempt: boolean
  /** Raison de l'exonération, reprise comme mention légale sur ses documents. */
  taxExemptionReason: string | null
}

export interface CreateCustomerRequest {
  type: CustomerType
  name: string
  phone?: string
  address?: string
  taxId?: string
}

export type UpdateCustomerRequest = CreateCustomerRequest

/** Client typé du module customer (annuaire client) — cf. boutiklic-core CustomerController,
 *  doc TVA §7 (question ouverte tranchée "oui" : un vrai annuaire client, pas seulement snapshotté
 *  sur les devis/factures). Mirror mobile de lib/customerApi.ts côté web. */
export const customerApi = {
  search: (query?: string) =>
    apiClient.get<CustomerResponse[]>(`/customers${query ? `?query=${encodeURIComponent(query)}` : ''}`),

  getById: (customerId: string) => apiClient.get<CustomerResponse>(`/customers/${customerId}`),

  create: (request: CreateCustomerRequest) => apiClient.post<CustomerResponse>('/customers', request),

  update: (customerId: string, request: UpdateCustomerRequest) =>
    apiClient.put<CustomerResponse>(`/customers/${customerId}`, request),

  /** Exonère le client de TVA (raison obligatoire) ou lève l'exonération. Réservé au propriétaire. */
  changeTaxExemption: (customerId: string, taxExempt: boolean, reason?: string) =>
    apiClient.patch<CustomerResponse>(`/customers/${customerId}/tax-exemption`, { taxExempt, reason }),

  deactivate: (customerId: string) => apiClient.delete<void>(`/customers/${customerId}`),
}
