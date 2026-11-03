import { apiClient } from './apiClient'

export interface DepotResponse {
  id: string
  name: string
  isDefault: boolean
  active: boolean
  createdAt: string
}

export interface CreateDepotRequest {
  name: string
}

export interface RenameDepotRequest {
  name: string
}

/** Client typé du module inventory/dépôts — cf. boutiklic-core DepotController (étude
 *  study/etude_multi_depots_transferts.md, phase 2). Le dépôt par défaut de chaque boutique est
 *  créé automatiquement côté serveur, jamais depuis cet écran. */
export const depotsApi = {
  getAll: () => apiClient.get<DepotResponse[]>('/depots'),

  create: (payload: CreateDepotRequest) => apiClient.post<DepotResponse>('/depots', payload),

  rename: (depotId: string, payload: RenameDepotRequest) =>
    apiClient.patch<DepotResponse>(`/depots/${depotId}`, payload),

  deactivate: (depotId: string) => apiClient.delete<void>(`/depots/${depotId}`),
}
