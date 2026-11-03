import { apiClient } from './apiClient'
import { getAccessToken, getActiveTenantId } from './session'

export type BilanPeriod = 'day' | 'month' | 'year'
export type ExportFormat = 'pdf' | 'image' | 'excel'

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

  getVatReport: (from: string, to: string) => apiClient.get<VatReportResponse>(`/reports/vat?from=${from}&to=${to}`),

  /** Renvoie un blob (PDF/image/Excel) — bypass apiClient (réponse binaire, pas JSON).
   * Écriture sur disque + partage (expo-file-system/expo-sharing) câblés en Phase 6. */
  async export(period: BilanPeriod, format: ExportFormat): Promise<Blob> {
    return fetchExportBlob(`period=${period}&format=${format}`)
  },

  async exportRange(from: string, to: string, format: ExportFormat): Promise<Blob> {
    return fetchExportBlob(`from=${from}&to=${to}&format=${format}`)
  },
}

async function fetchExportBlob(query: string): Promise<Blob> {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
  const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
  const response = await fetch(`${apiBase}/reports/export?${query}`, {
    headers: {
      Authorization: `Bearer ${token ?? ''}`,
      'X-Tenant-ID': tenantId ?? '',
    },
  })
  if (!response.ok) throw new Error(`Export échoué (${response.status})`)
  return response.blob()
}

// ===== Rapports et exports des ventes (cf. boutiklic-core SalesReportController) =====

export type SalesReportType =
  | 'SUMMARY' | 'DAILY' | 'PRODUCT' | 'CATEGORY' | 'MARGIN' | 'TOP_PRODUCTS' | 'DETAIL' | 'PAYMENT' | 'CREDIT'
  | 'DISCOUNT' | 'RETURN' | 'SELLER' | 'VAT' | 'DEPOT' | 'CASH'
export type SalesReportPeriod = 'DAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'CUSTOM'
export type SalesReportFormat = 'xlsx' | 'csv' | 'pdf'
type CellKind = 'TEXT' | 'INTEGER' | 'AMOUNT' | 'DATE_TIME' | 'DATE'

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
  indicators: { label: string; type: CellKind; value: string | number | null }[]
  columns: { label: string; type: CellKind }[]
  rows: (string | number | null)[][]
  totals: (string | number | null)[] | null
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

/** Rapport trop volumineux pour un téléchargement immédiat : l'API propose alors un export en arrière-plan. */
export class ReportTooLargeError extends Error {
  constructor(message: string, readonly maxRows: number) {
    super(message)
    this.name = 'ReportTooLargeError'
  }
}

function salesReportParams(query: SalesReportQuery): string {
  const params = new URLSearchParams({ type: query.type, period: query.period, lang: query.language })
  if (query.period === 'CUSTOM' && query.from && query.to) {
    params.set('from', query.from)
    params.set('to', query.to)
  }
  return params.toString()
}

/** Lit la réponse d'erreur (RFC 7807) d'un export : REPORT_003 = trop gros, le reste devient un message lisible. */
async function exportError(response: Response): Promise<Error> {
  const problem = await response.json().catch(() => null) as { errorCode?: string; detail?: string; maxRows?: number } | null
  if (problem?.errorCode === 'REPORT_003') return new ReportTooLargeError(problem.detail ?? '', problem.maxRows ?? 0)
  return new Error(problem?.detail ?? `Export échoué (${response.status})`)
}

/** Télécharge un fichier d'export en mémoire (pas de `File.downloadFileAsync` : il ne laisse pas lire le corps d'une erreur). */
async function fetchExportBytes(path: string): Promise<Uint8Array> {
  const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
  const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
  const response = await fetch(`${apiBase}${path}`, {
    headers: { Authorization: `Bearer ${token ?? ''}`, 'X-Tenant-ID': tenantId ?? '' },
  })
  if (!response.ok) throw await exportError(response)
  return new Uint8Array(await response.arrayBuffer())
}

export const salesReportsApi = {
  get: (query: SalesReportQuery) => apiClient.get<SalesReportResponse>(`/reports/sales?${salesReportParams(query)}`),

  export: (query: SalesReportQuery, format: SalesReportFormat) =>
    fetchExportBytes(`/reports/sales?${salesReportParams(query)}&format=${format}`),

  /** Le même rapport sur des données FICTIVES (aucune vente lue) — pour voir le format avant d'exporter pour de vrai. */
  exportSample: (query: SalesReportQuery, format: SalesReportFormat) =>
    fetchExportBytes(`/reports/sales/sample?${salesReportParams(query)}&format=${format}`),

  startJob: (query: SalesReportQuery, format: SalesReportFormat) =>
    apiClient.post<SalesExportJob>(`/reports/sales/jobs?${salesReportParams(query)}&format=${format}`),

  getJob: (id: string) => apiClient.get<SalesExportJob>(`/reports/sales/jobs/${id}`),

  downloadJob: (id: string) => fetchExportBytes(`/reports/sales/jobs/${id}/download`),
}
