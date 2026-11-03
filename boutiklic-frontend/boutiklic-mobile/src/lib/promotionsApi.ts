import { apiClient } from './apiClient'

export type PromotionType = 'PERCENTAGE' | 'AMOUNT'

export interface PromotionResponse {
  id: string
  name: string
  type: PromotionType
  value: number
  currency: string
  startDate: string
  endDate: string
  active: boolean
  productIds: string[]
  categoryIds: string[]
  createdBy: string
  createdAt: string
}

export interface CreatePromotionRequest {
  name: string
  type: PromotionType
  value: number
  currency: string
  startDate: string
  endDate: string
  productIds: string[]
  categoryIds: string[]
}

/**
 * Client typé du module product_catalog/promotions — cf. boutiklic-core PromotionController.
 * Décidée à l'avance par le propriétaire, appliquée automatiquement — pas de validation vendeur,
 * contrairement au rabais ponctuel (lib/discountsApi).
 */
export const promotionsApi = {
  getAll: (active?: boolean) => apiClient.get<PromotionResponse[]>(`/promotions${active ? '?active=true' : ''}`),

  create: (payload: CreatePromotionRequest) => apiClient.post<PromotionResponse>('/promotions', payload),

  update: (promotionId: string, payload: CreatePromotionRequest) =>
    apiClient.patch<PromotionResponse>(`/promotions/${promotionId}`, payload),

  setActive: (promotionId: string, value: boolean) =>
    apiClient.patch<void>(`/promotions/${promotionId}/active?value=${value}`),

  remove: (promotionId: string) => apiClient.delete<void>(`/promotions/${promotionId}`),
}
