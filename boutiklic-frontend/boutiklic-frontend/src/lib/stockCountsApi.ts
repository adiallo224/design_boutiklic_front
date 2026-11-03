import type { InventoryExportFormat, StockCountImportErrorCode, StockCountStatus } from '@boutiklic/shared'
import { apiClient } from './apiClient'

export interface StockCountLineResponse {
  productId: string
  /** null pendant un comptage aveugle pour qui n'a pas la permission de gestion. */
  systemQty: number | null
  countedQty: number | null
  countedAt: string | null
  countedBy: string | null
  /** Variation réellement appliquée au stock ; renseignée à la validation seulement. */
  appliedDelta: number | null
}

export interface StockCountResponse {
  id: string
  depotId: string
  categoryId: string | null
  blind: boolean
  status: StockCountStatus
  snapshotAt: string
  createdBy: string
  validatedBy: string | null
  note: string | null
  createdAt: string
  validatedAt: string | null
  lineCount: number
  countedCount: number
  /** null dans la liste, renseigné dans le détail. */
  lines: StockCountLineResponse[] | null
}

export interface StartStockCountRequest {
  depotId?: string
  categoryId?: string
  /** Absent = comptage aveugle. */
  blind?: boolean
  note?: string
}

export interface StockCountImportError {
  row: number
  code: StockCountImportErrorCode
  reference: string
  message: string
}

export interface StockCountImportResponse {
  applied: boolean
  rowCount: number
  readyCount: number
  emptyCount: number
  errors: StockCountImportError[]
}

/** Client typé de l'inventaire physique — cf. boutiklic-core StockCountController (étude study/etude_inventaire_physique.md). */
export const stockCountsApi = {
  list: () => apiClient.get<StockCountResponse[]>('/stock-counts'),

  get: (countId: string) => apiClient.get<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}`),

  start: (payload: StartStockCountRequest) => apiClient.post<StockCountResponse>('/stock-counts', payload),

  /** La saisie la plus récente d'un article gagne. Uniquement pendant COUNTING. */
  recordCounts: (countId: string, lines: { productId: string; quantity: number }[]) =>
    apiClient.put<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/lines`, { lines }),

  /** L'article redevient « non compté ». */
  clearCount: (countId: string, productId: string) =>
    apiClient.delete<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/lines/${encodeURIComponent(productId)}`),

  submit: (countId: string) => apiClient.post<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/submit`),

  reopen: (countId: string) => apiClient.post<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/reopen`),

  /** Applique les écarts au stock (tout ou rien côté serveur). */
  validate: (countId: string) => apiClient.post<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/validate`),

  cancel: (countId: string) => apiClient.post<StockCountResponse>(`/stock-counts/${encodeURIComponent(countId)}/cancel`),

  /** Feuille de comptage à imprimer (PDF) ou à remplir puis ré-importer (Excel, CSV). */
  downloadSheet: (countId: string, format: InventoryExportFormat) =>
    apiClient.get<Blob>(`/stock-counts/${encodeURIComponent(countId)}/sheet?format=${format}`, { responseType: 'blob' }),

  /** Sans `apply` : aperçu, rien n'est enregistré. Une ligne en erreur bloque l'application sauf `skipInvalid`. */
  importSheet: (countId: string, file: File, options: { apply: boolean; skipInvalid?: boolean }) => {
    const formData = new FormData()
    formData.append('file', file)
    const query = new URLSearchParams({ apply: String(options.apply), skipInvalid: String(options.skipInvalid ?? false) })
    return apiClient.post<StockCountImportResponse>(`/stock-counts/${encodeURIComponent(countId)}/import?${query}`, formData)
  },
}
