import { apiClient } from './apiClient'

export interface TransferLine {
  productId: string
  quantity: number
}

export interface CreateStockTransferRequest {
  sourceDepotId: string
  destinationDepotId: string
  lines: TransferLine[]
}

/** {@code destinationDepotId} omis : résout vers le dépôt par défaut de la boutique destination —
 *  on ne peut pas lister les dépôts d'une boutique où on n'est pas authentifié (étude
 *  study/etude_multi_depots_transferts.md §5). */
export interface CreateInterBoutiqueTransferRequest {
  sourceDepotId: string
  destinationTenantId: string
  lines: TransferLine[]
}

export type StockTransferStatus = 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED'

export interface StockTransferResponse {
  id: string
  sourceTenantId: string
  sourceDepotId: string
  destinationTenantId: string
  destinationDepotId: string
  status: StockTransferStatus
  totalUnits: number
  createdBy: string
  receivedBy: string | null
  createdAt: string
  receivedAt: string | null
  cancelledAt: string | null
  lines: TransferLine[]
}

export interface TransferDestinationResponse {
  tenantId: string
  name: string
  city: string
}

/** Client typé du module inventory/transferts — cf. boutiklic-core StockTransferController (étude
 *  study/etude_multi_depots_transferts.md). `send`/`getAll`/`getById`/`receive`/`cancel` couvrent
 *  l'intra-boutique (phase 3) comme l'inter-boutiques (phase 4, réception/annulation identiques —
 *  seul l'envoi diffère, cf. `sendInterBoutique`/`getDestinations`, réservés à OWNER côté serveur). */
export const stockTransfersApi = {
  getAll: () => apiClient.get<StockTransferResponse[]>('/stock-transfers'),

  getById: (transferId: string) => apiClient.get<StockTransferResponse>(`/stock-transfers/${transferId}`),

  send: (payload: CreateStockTransferRequest) => apiClient.post<StockTransferResponse>('/stock-transfers', payload),

  sendInterBoutique: (payload: CreateInterBoutiqueTransferRequest) =>
    apiClient.post<StockTransferResponse>('/stock-transfers/inter-boutique', payload),

  getDestinations: () => apiClient.get<TransferDestinationResponse[]>('/stock-transfers/destinations'),

  receive: (transferId: string) => apiClient.post<StockTransferResponse>(`/stock-transfers/${transferId}/receive`),

  cancel: (transferId: string) => apiClient.post<StockTransferResponse>(`/stock-transfers/${transferId}/cancel`),
}
