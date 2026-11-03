import { apiClient } from './apiClient'
import { getAccessToken, getActiveTenantId } from './session'

/** Clés canoniques d'un columnMapping — cf. boutiklic-core ImportField. */
export const IMPORT_FIELDS = ['nom', 'code_barres', 'categorie', 'prix_achat', 'prix_vente', 'quantite_initiale', 'devise'] as const
export type ImportFieldKey = (typeof IMPORT_FIELDS)[number]

export type ImportLineAction = 'CREATED' | 'UPDATED'

export interface PreviewLine {
  lineNumber: number
  rawData: Record<string, string>
  valid: boolean
  errors: string[]
  /** Non-null si `valid` : indique si le code-barres correspond déjà à un article existant pour la
   *  boutique (Phase 2, dédoublonnage) — avant même de confirmer l'import. */
  action: ImportLineAction | null
}

export interface PreviewResponse {
  headers: string[]
  suggestedMapping: Record<string, string>
  sample: PreviewLine[]
  totalLines: number
  errorLines: number
}

export interface StartImportResponse {
  importJobId: string
  status: string
}

export type ImportJobStatus = 'PENDING' | 'RUNNING' | 'DONE' | 'PARTIAL' | 'FAILED'

export interface ImportStatusResponse {
  id: string
  status: ImportJobStatus
  totalLines: number
  successCount: number
  errorCount: number
  progressPercent: number
}

export interface ImportReportLine {
  lineNumber: number
  status: 'OK' | 'ERROR'
  errorReason: string | null
  createdProductId: string | null
  /** Non-null si `status === 'OK'`. */
  action: ImportLineAction | null
}

export interface ImportReportResponse {
  lines: ImportReportLine[]
}

export function isTerminalImportStatus(status: ImportJobStatus): boolean {
  return status === 'DONE' || status === 'PARTIAL' || status === 'FAILED'
}

/** Client typé du module catalog_import — cf. boutiklic-core ImportJobController (écran import catalogue). */
export const importApi = {
  /** Réponse binaire (XLSX) — bypass apiClient, même idiome que reportingApi.dataExport(). */
  async downloadTemplate(): Promise<Blob> {
    const apiBase = import.meta.env.VITE_API_BASE_URL ?? '/api'
    const response = await fetch(`${apiBase}/imports/template`, {
      headers: {
        Authorization: `Bearer ${getAccessToken() ?? ''}`,
        'X-Tenant-ID': getActiveTenantId() ?? '',
      },
    })
    if (!response.ok) throw new Error(`Téléchargement du modèle échoué (${response.status})`)
    return response.blob()
  },

  preview: (file: File, columnMapping?: Record<string, string>, defaultCurrency?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (columnMapping && Object.keys(columnMapping).length > 0) formData.append('columnMapping', JSON.stringify(columnMapping))
    if (defaultCurrency) formData.append('defaultCurrency', defaultCurrency)
    return apiClient.post<PreviewResponse>('/imports/preview', formData)
  },

  start: (file: File, columnMapping: Record<string, string>, defaultCurrency: string) => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('columnMapping', JSON.stringify(columnMapping))
    formData.append('defaultCurrency', defaultCurrency)
    return apiClient.post<StartImportResponse>('/imports', formData)
  },

  getStatus: (importJobId: string) => apiClient.get<ImportStatusResponse>(`/imports/${importJobId}`),

  getReport: (importJobId: string) => apiClient.get<ImportReportResponse>(`/imports/${importJobId}/report`),

  retry: (importJobId: string) => apiClient.post<ImportStatusResponse>(`/imports/${importJobId}/retry`),
}
