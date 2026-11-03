import { apiClient } from './apiClient'

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED' | 'CONVERTED'
export type BillingPartyType = 'PARTICULIER' | 'ENTREPRISE'

export interface QuoteLineResponse {
  id: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  taxCategoryId: string | null
  taxRateApplied: number | null
  lineTotalHt: number
  taxAmount: number
  lineTotalTtc: number
}

export interface QuoteResponse {
  id: string
  tenantId: string
  currency: string
  status: QuoteStatus
  buyerType: BillingPartyType
  buyerName: string
  buyerPhone: string | null
  buyerAddress: string | null
  buyerTaxId: string | null
  buyerCustomerId: string | null
  /** Client exonéré de TVA au moment du devis (snapshot) : lignes sans TVA, mention légale sur le document. */
  buyerTaxExempt: boolean
  buyerTaxExemptionReason: string | null
  lines: QuoteLineResponse[]
  totalHt: number
  totalTax: number
  totalTtc: number
  createdAt: string
  expiresAt: string | null
  convertedSaleId: string | null
}

export interface CreateQuoteRequest {
  currency: string
  buyerType: BillingPartyType
  buyerName?: string
  buyerPhone?: string
  buyerAddress?: string
  buyerTaxId?: string
  customerId?: string
  expiresAt?: string
}

export interface AddQuoteLineRequest {
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  taxCategoryId?: string | null
}

export interface InvoiceLineResponse {
  id: string
  productId: string
  productName: string
  unitPrice: number
  quantity: number
  taxCategoryId: string | null
  taxRateApplied: number | null
  lineTotalHt: number
  taxAmount: number
  lineTotalTtc: number
}

export interface InvoiceResponse {
  id: string
  tenantId: string
  currency: string
  number: string
  saleId: string
  quoteId: string | null
  buyerType: BillingPartyType
  buyerName: string
  buyerPhone: string | null
  buyerAddress: string | null
  buyerTaxId: string | null
  buyerCustomerId: string | null
  /** Vente exonérée de TVA (client exonéré) : la facture porte la mention d'exonération. */
  buyerTaxExempt: boolean
  buyerTaxExemptionReason: string | null
  sellerName: string
  sellerAddress: string | null
  sellerPhone: string | null
  sellerTaxId: string | null
  sellerRccm: string | null
  sellerVatRegistrationKey: string | null
  lines: InvoiceLineResponse[]
  totalHt: number
  totalTax: number
  totalTtc: number
  issuedAt: string
}

/** Le vendeur (seller) n'est jamais saisi ici : résolu automatiquement côté backend depuis le profil
 *  boutique courant (Tenant), snapshotté à l'émission (doc TVA §3.4). */
export interface GenerateInvoiceRequest {
  saleId: string
  quoteId?: string
  buyerType: BillingPartyType
  buyerName?: string
  buyerPhone?: string
  buyerAddress?: string
  buyerTaxId?: string
  buyerCustomerId?: string
}

/** Client typé du module billing (devis + facture) — cf. boutiklic-core QuoteController/
 *  InvoiceController, doc TVA §3.4/§5. Mirror mobile de lib/billingApi.ts côté web. */
export const billingApi = {
  createQuote: (request: CreateQuoteRequest) => apiClient.post<QuoteResponse>('/quotes', request),

  addLine: (quoteId: string, request: AddQuoteLineRequest) =>
    apiClient.post<QuoteResponse>(`/quotes/${quoteId}/lines`, request),

  removeLine: (quoteId: string, quoteLineId: string) =>
    apiClient.delete<QuoteResponse>(`/quotes/${quoteId}/lines/${quoteLineId}`),

  send: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/send`),

  refuse: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/refuse`),

  expire: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/expire`),

  /** Accepte le devis : crée une vente brouillon à partir de ses lignes (doc §3.4). */
  accept: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/accept`),

  getById: (quoteId: string) => apiClient.get<QuoteResponse>(`/quotes/${quoteId}`),

  list: (status?: QuoteStatus) =>
    apiClient.get<QuoteResponse[]>(`/quotes${status ? `?status=${status}` : ''}`),

  generateInvoice: (request: GenerateInvoiceRequest) => apiClient.post<InvoiceResponse>('/invoices', request),

  getInvoiceById: (invoiceId: string) => apiClient.get<InvoiceResponse>(`/invoices/${invoiceId}`),

  listInvoices: () => apiClient.get<InvoiceResponse[]>('/invoices'),
}
