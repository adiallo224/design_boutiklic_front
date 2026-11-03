import { apiClient } from './apiClient'
import { getAccessToken, getActiveTenantId } from './session'

export type BilanPeriod = 'day' | 'month' | 'year'
export type ExportFormat = 'pdf' | 'image' | 'excel'

export type SalesReportType = 'SUMMARY' | 'DAILY' | 'PRODUCT' | 'CATEGORY' | 'MARGIN' | 'TOP_PRODUCTS' | 'DETAIL' | 'PAYMENT' | 'CREDIT' | 'DISCOUNT' | 'RETURN' | 'SELLER' | 'VAT' | 'DEPOT' | 'CASH'
export type SalesReportPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'
export type SalesReportFormat = 'xlsx' | 'csv' | 'pdf'

export interface SalesReportQuery {
  type: SalesReportType
  period: SalesReportPeriod
  /** AAAA-MM-JJ, seulement pour CUSTOM. */
  from?: string
  to?: string
  language: string
}

/** Aperçu d'un rapport de ventes : une cellule par colonne dans chaque ligne (montant/entier = nombre, vide = null). */
export interface SalesReportResponse {
  title: string
  subtitle: string
  shopName: string
  currency: string
  amountDecimals: number
  indicators: { label: string; type: 'TEXT' | 'INTEGER' | 'AMOUNT' | 'DATE_TIME' | 'DATE'; value: string | number | null }[]
  columns: { label: string; type: 'TEXT' | 'INTEGER' | 'AMOUNT' | 'DATE_TIME' | 'DATE' }[]
  rows: (string | number | null)[][]
  totals: (string | number | null)[] | null
}

function salesReportParams(query: SalesReportQuery): string {
  const params = new URLSearchParams({ type: query.type, period: query.period, lang: query.language })
  if (query.period === 'CUSTOM' && query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  }
  return params.toString()
}

export interface TopProductResponse {
  productName: string
  quantitySold: number
  percentageOfTotal: number
}

export interface DailyRevenueResponse {
  dayLabel: string
  revenue: number
  isToday: boolean
}

export interface DashboardResponse {
  salesToday: number
  salesYesterday: number
  /** null pour SELLER/SUPERVISOR — bénéfice réservé au propriétaire, cf. ReportingController.maskFinancials. */
  profitToday: number | null
  profitYesterday: number | null
  outstandingDebt: number
  debtorCount: number
  /** null pour SELLER/SUPERVISOR — valeur du stock réservée au propriétaire. */
  stockValue: number | null
  stockItemCount: number
  lowStockCount: number
  outOfStockCount: number
  /** null pour SELLER/SUPERVISOR — répartition brut/promotions/rabais/caisse réservée au propriétaire. */
  grossSalesToday: number | null
  promotionsToday: number | null
  discountsToday: number | null
  /** null si aucun comptage physique de caisse saisi aujourd'hui — distinct d'un écart de 0, cf. "Compter la caisse". */
  cashCollectedToday: number | null
  cashGapToday: number | null
  /** Espèces attendues aujourd'hui ; null pour SELLER/SUPERVISOR (réservé au propriétaire). */
  cashExpectedToday: number | null
  topProducts: TopProductResponse[]
  last7Days: DailyRevenueResponse[]
}

export interface DailyBreakdownResponse {
  date: string
  revenue: number
  margin: number
}

export interface TopProfitableProductResponse {
  productName: string
  quantitySold: number
  revenue: number
  margin: number
  marginPercent: number
}

export interface BilanResponse {
  periodStart: string
  periodEnd: string
  revenue: number
  costOfGoodsSold: number
  profit: number
  outstandingDebt: number
  grossSales: number
  promotions: number
  discounts: number
  /** null si aucun comptage physique de caisse saisi sur la période — distinct d'un écart de 0. */
  cashCollected: number | null
  cashGap: number | null
  dailyRevenueSeries: number[]
  /** Une entrée par jour, zéro explicite (pas de trou d'index comme dailyRevenueSeries) — ajouté
   *  pour l'écran Statistiques & Marges (étude study/web/statistique_web_page_redesign). */
  dailySeries: DailyBreakdownResponse[]
  /** Classement par CA sur toute la période (pas seulement aujourd'hui, contrairement à
   *  DashboardResponse.topProducts) avec marge réelle par produit. */
  topProfitableProducts: TopProfitableProductResponse[]
}

export interface VatRateLineResponse {
  /** null = ventes sans TVA (boutique qui ne l'appliquait pas encore) : HT = TTC. */
  ratePercent: number | null
  totalHt: number
  totalTax: number
  totalTtc: number
  /** true = ventes EXONÉRÉES (client exonéré), à part des ventes simplement sans TVA. */
  exempt: boolean
}

/** TVA collectée par taux sur une période, nette des retours — base d'une déclaration (propriétaire uniquement). */
export interface VatReportResponse {
  periodStart: string
  periodEnd: string
  lines: VatRateLineResponse[]
  totalHt: number
  totalTax: number
  totalTtc: number
  /** TVA payée aux fournisseurs sur les arrivages de la période (saisie sur l'arrivage). */
  deductibleTax: number
  /** TVA à payer = collectée − déductible ; négative = crédit de TVA. */
  netTaxPayable: number
}

/** Client typé du module reporting — cf. boutiklic-core ReportingController (écrans E1, E2). */
export const reportingApi = {
  getDashboard: () => apiClient.get<DashboardResponse>('/reports/dashboard'),

  getBilan: (period: BilanPeriod = 'month') => apiClient.get<BilanResponse>(`/reports/bilan?period=${period}`),

  getBilanRange: (from: string, to: string) => apiClient.get<BilanResponse>(`/reports/bilan?from=${from}&to=${to}`),

  /** Renvoie un blob (PDF/image/Excel) — bypass apiClient (réponse binaire, pas JSON). */
  async export(period: BilanPeriod, format: ExportFormat): Promise<Blob> {
    return fetchExportBlob(`period=${period}&format=${format}`)
  },

  async exportRange(from: string, to: string, format: ExportFormat): Promise<Blob> {
    return fetchExportBlob(`from=${from}&to=${to}&format=${format}`)
  },

  getVatReport: (from: string, to: string) => apiClient.get<VatReportResponse>(`/reports/vat?from=${from}&to=${to}`),

  /** Le rapport de TVA en CSV (ouvert par Excel) — bypass apiClient (réponse binaire, pas JSON). */
  async exportVatCsv(from: string, to: string, language: string): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/reports/vat/export?from=${from}&to=${to}&lang=${encodeURIComponent(language)}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Export échoué (${response.status})`)
    return response.blob()
  },

  /** Rapports de ventes (aperçu JSON) — cf. boutiklic-core SalesReportController. */
  getSalesReport: (query: SalesReportQuery) => apiClient.get<SalesReportResponse>(`/reports/sales?${salesReportParams(query)}`),

  /** Le même rapport en fichier — bypass apiClient (réponse binaire, pas JSON). */
  async exportSalesReport(query: SalesReportQuery, format: SalesReportFormat): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/reports/sales?${salesReportParams(query)}&format=${format}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw await exportError(response)
    return response.blob()
  },

  /** Le même rapport sur des données FICTIVES (aucune vente lue) — pour voir le format avant d'exporter pour de vrai. */
  async exportSalesSample(query: SalesReportQuery, format: SalesReportFormat): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/reports/sales/sample?${salesReportParams(query)}&format=${format}`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Export échoué (${response.status})`)
    return response.blob()
  },

  /** Export brut ventes/stock/dettes/fournisseurs en ZIP de CSV (écran F3, "Exporter mes données"). */
  async dataExport(): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/reports/data-export`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Export échoué (${response.status})`)
    return response.blob()
  },
}

async function fetchExportBlob(query: string): Promise<Blob> {
  const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
  const response = await fetch(`${apiBase}/reports/export?${query}`, {
    headers: {
      Authorization: `Bearer ${getAccessToken() ?? ''}`,
      'X-Tenant-ID': getActiveTenantId() ?? '',
    },
  })
  if (!response.ok) throw new Error(`Export échoué (${response.status})`)
  return response.blob()
}

/** Rapport trop volumineux pour un téléchargement immédiat : l'API propose alors un export en arrière-plan. */
export class ReportTooLargeError extends Error {
  constructor(message: string, readonly maxRows: number) {
    super(message)
    this.name = 'ReportTooLargeError'
  }
}

/** Lit la réponse d'erreur (RFC 7807) d'un export : REPORT_003 = trop gros, le reste devient un message lisible. */
async function exportError(response: Response): Promise<Error> {
  const problem = await response.json().catch(() => null) as { errorCode?: string; detail?: string; maxRows?: number } | null
  if (problem?.errorCode === 'REPORT_003') return new ReportTooLargeError(problem.detail ?? '', problem.maxRows ?? 0)
  return new Error(problem?.detail ?? `Export échoué (${response.status})`)
}

export type SalesExportJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED'

/** Un export de rapport préparé en arrière-plan. Le fichier se télécharge quand `status` vaut DONE, pendant 24 h. */
export interface SalesExportJob {
  id: string
  status: SalesExportJobStatus
  fileName: string | null
  errorMessage: string | null
  sizeBytes: number | null
  createdAt: string
  completedAt: string | null
  expiresAt: string
}

export const salesExportJobsApi = {
  start: (query: SalesReportQuery, format: SalesReportFormat) =>
    apiClient.post<SalesExportJob>(`/reports/sales/jobs?${salesReportParams(query)}&format=${format}`),

  get: (id: string) => apiClient.get<SalesExportJob>(`/reports/sales/jobs/${id}`),

  async download(id: string): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/reports/sales/jobs/${id}/download`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw await exportError(response)
    return response.blob()
  },
}
