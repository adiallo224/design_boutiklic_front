import { apiClient } from './apiClient'
import { getAccessToken, getActiveTenantId } from './session'

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REFUSED' | 'EXPIRED' | 'CONVERTED'
export type BillingPartyType = 'PARTICULIER' | 'ENTREPRISE'

export interface QuoteLineResponse {
  id: string
  /** null = ligne libre (sans produit catalogue, doc devis type prestation de service). */
  productId: string | null
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
  /** Numéro d'affichage séquentiel, ex "DEV-2026-000001". */
  quoteNumber: string
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
  preparedBy: string | null
  paymentTerms: string | null
  deliveryTerms: string | null
  depositAmount: number
  netToPay: number
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
  preparedBy?: string
}

export interface AddQuoteLineRequest {
  /** Absent/vide = ligne libre : productName porte alors la description saisie à la main. */
  productId?: string | null
  productName: string
  unitPrice: number
  quantity: number
  taxCategoryId?: string | null
}

export interface UpdateQuoteTermsRequest {
  preparedBy?: string | null
  paymentTerms?: string | null
  deliveryTerms?: string | null
  depositAmount?: number
}

/** Client typé du module billing (devis) — cf. boutiklic-core QuoteController, doc TVA §3.4. */
export const billingApi = {
  createQuote: (request: CreateQuoteRequest) => apiClient.post<QuoteResponse>('/quotes', request),

  addLine: (quoteId: string, request: AddQuoteLineRequest) =>
    apiClient.post<QuoteResponse>(`/quotes/${quoteId}/lines`, request),

  removeLine: (quoteId: string, quoteLineId: string) =>
    apiClient.delete<QuoteResponse>(`/quotes/${quoteId}/lines/${quoteLineId}`),

  updateTerms: (quoteId: string, request: UpdateQuoteTermsRequest) =>
    apiClient.patch<QuoteResponse>(`/quotes/${quoteId}/terms`, request),

  /** PDF généré côté serveur — bypass apiClient (réponse binaire, pas JSON), même pattern que
   *  reportingApi.export. */
  async downloadPdf(quoteId: string): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/quotes/${quoteId}/pdf`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Téléchargement échoué (${response.status})`)
    return response.blob()
  },

  send: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/send`),

  refuse: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/refuse`),

  expire: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/expire`),

  /** Accepte le devis : crée une vente brouillon à partir de ses lignes (doc §3.4). */
  accept: (quoteId: string) => apiClient.post<QuoteResponse>(`/quotes/${quoteId}/accept`),

  getById: (quoteId: string) => apiClient.get<QuoteResponse>(`/quotes/${quoteId}`),

  list: (status?: QuoteStatus) =>
    apiClient.get<QuoteResponse[]>(`/quotes${status ? `?status=${status}` : ''}`),

  // ===================== Facture (Invoice, doc TVA §3.4/§5) =====================

  generateInvoice: (request: GenerateInvoiceRequest) => apiClient.post<InvoiceResponse>('/invoices', request),

  getInvoiceById: (invoiceId: string) => apiClient.get<InvoiceResponse>(`/invoices/${invoiceId}`),

  listInvoices: () => apiClient.get<InvoiceResponse[]>('/invoices'),

  /** PDF généré côté serveur — bypass apiClient (réponse binaire, pas JSON), même pattern que
   *  billingApi.downloadPdf (devis). */
  async downloadInvoicePdf(invoiceId: string): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/invoices/${invoiceId}/pdf`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Téléchargement échoué (${response.status})`)
    return response.blob()
  },
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
  depositAmount: number
  netToPay: number
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
