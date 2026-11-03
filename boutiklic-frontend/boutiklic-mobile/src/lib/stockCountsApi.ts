import type { StockCountStatus } from '@boutiklic/shared'
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

/** Client typé de l'inventaire physique — cf. boutiklic-core StockCountController (étude study/etude_inventaire_physique.md).
 *  L'import de fichier rempli reste un geste du poste de travail (web/desktop) : le mobile compte au scan. */
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

  /** URL de la feuille de comptage (PDF à imprimer, Excel/CSV à remplir) — téléchargée avec les en-têtes d'authentification. */
  sheetPath: (countId: string, format: 'xlsx' | 'pdf' | 'csv') => `/stock-counts/${encodeURIComponent(countId)}/sheet?format=${format}`,
}
