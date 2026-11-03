import { buildInventoryExportQuery, type InventoryExportParams } from '@boutiklic/shared'
import { apiClient } from './apiClient'

export interface StockLineResponse {
  productId: string
  quantity: number
  alertThreshold: number
  status: string
  lastRestockAt: string | null
}

export interface StockSummaryResponse {
  totalLines: number
  outOfStockCount: number
  lowStockCount: number
}

export interface StockMovementResponse {
  productId: string
  movementType: string
  quantityDelta: number
  referenceType: string
  referenceId: string
  createdAt: string
}

export type StockFilter = 'all' | 'out_of_stock' | 'low_stock'

export interface StockIntakeLine {
  productId: string
  quantity: number
  unitPurchasePrice: number
  /** Achat par lot : les trois vont ensemble. Le serveur DÉRIVE alors la quantité (lots × unités) et le prix
   *  unitaire, et ignore `quantity` / `unitPurchasePrice` (toujours requis par l'API). Total = lots × prix du lot. */
  packCount?: number
  unitsPerPack?: number
  packPrice?: number
}

export interface CreateStockIntakeRequest {
  supplierId?: string
  currency: string
  lines: StockIntakeLine[]
  /** Dépôt ciblé — résout vers le dépôt par défaut du tenant côté serveur quand omis (étude
   *  study/etude_multi_depots_transferts.md §2.2, phase 2b). */
  depotId?: string
  /** TVA payée au fournisseur sur cet arrivage (déductible) ; saisie à part, n'entre pas dans le coût d'achat. */
  deductibleVat?: number
}

export interface IntakeLineResponse {
  productId: string
  quantity: number
  unitPurchasePrice: number
  lineTotal: number
  packCount: number | null
  unitsPerPack: number | null
  packPrice: number | null
}

export interface StockIntakeResponse {
  id: string
  supplierId: string | null
  totalAmount: number
  totalUnits: number
  createdAt: string
  lines: IntakeLineResponse[]
  /** Absent chez un serveur ancien : 0. */
  deductibleVat?: number
}

/** Client typé du module inventory/stock — cf. boutiklic-core InventoryController + StockIntakeController
 *  (écrans C1, C2, C5). `depotId` optionnel partout : omis, le serveur résout le dépôt par défaut du
 *  tenant (étude study/etude_multi_depots_transferts.md §2.2, phase 2b). */
export const inventoryApi = {
  getOverview: (filter: StockFilter = 'all', depotId?: string) =>
    apiClient.get<StockLineResponse[]>(`/inventory?filter=${filter}${depotId ? `&depotId=${depotId}` : ''}`),

  getSummary: (depotId?: string) =>
    apiClient.get<StockSummaryResponse>(`/inventory/summary${depotId ? `?depotId=${depotId}` : ''}`),

  getByProduct: (productId: string, depotId?: string) =>
    apiClient.get<StockLineResponse>(`/inventory/${productId}${depotId ? `?depotId=${depotId}` : ''}`),

  getMovements: (productId: string, limit = 20, depotId?: string) =>
    apiClient.get<StockMovementResponse[]>(`/inventory/${productId}/movements?limit=${limit}${depotId ? `&depotId=${depotId}` : ''}`),

  adjust: (productId: string, delta: number, reason: string, depotId?: string) =>
    apiClient.patch<StockLineResponse>(`/inventory/${productId}/adjust${depotId ? `?depotId=${depotId}` : ''}`, { delta, reason }),

  changeThreshold: (productId: string, alertThreshold: number, depotId?: string) =>
    apiClient.patch<StockLineResponse>(`/inventory/${productId}/threshold${depotId ? `?depotId=${depotId}` : ''}`, { alertThreshold }),

  createIntake: (payload: CreateStockIntakeRequest) =>
    apiClient.post<StockIntakeResponse>('/stock-intakes', payload),

  getIntakes: () => apiClient.get<StockIntakeResponse[]>('/stock-intakes'),

  /** Corrige un arrivage (fournisseur, dépôt et date conservés) : stock et dette fournisseur sont ajustés de la différence. */
  updateIntake: (intakeId: string, payload: { lines: StockIntakeLine[]; deductibleVat?: number }) =>
    apiClient.put<StockIntakeResponse>(`/stock-intakes/${encodeURIComponent(intakeId)}`, payload),

  /** Supprime un arrivage : retire le stock reçu et la dette fournisseur associée (refusé si le stock est déjà écoulé). */
  deleteIntake: (intakeId: string) => apiClient.delete<void>(`/stock-intakes/${encodeURIComponent(intakeId)}`),

  /** Export d'inventaire (Excel/CSV/PDF) : le rapport choisi décide des paramètres lus, cf. buildInventoryExportQuery. */
  exportReport: (params: InventoryExportParams) =>
    apiClient.get<Blob>(`/inventory/export?${buildInventoryExportQuery(params)}`, { responseType: 'blob' }),
}
