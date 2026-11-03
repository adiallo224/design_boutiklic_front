import { apiClient } from './apiClient'
import type { Entitlements } from './entitlementsApi'

/** Une offre proposée aux clients. Limite absente de `limits` = illimité. */
export interface PlanResponse {
  code: string
  name: string
  features: string[]
  limits: Record<string, number>
}

export type ChangeRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED'

export interface ChangeRequestResponse {
  id: string
  fromPlan: string | null
  toPlan: string
  message: string | null
  status: ChangeRequestStatus
  /** Mot de l'administrateur à l'acceptation ou au refus. */
  resolutionNote: string | null
  createdAt: string
  resolvedAt: string | null
}

export interface OverviewResponse {
  /** null = pas encore d'abonnement : les droits viennent de l'ancien système (Gratuit / Premium). */
  planCode: string | null
  planName: string | null
  status: string | null
  /** Fin de la période payée ; null = sans échéance. */
  periodEnd: string | null
  entitlements: Entitlements
  pending: ChangeRequestResponse | null
  recent: ChangeRequestResponse[]
}

/** Client typé de « Mon offre » — cf. boutiklic-core SubscriptionController. Demander ou annuler un changement est réservé au propriétaire (403 sinon). */
export const subscriptionApi = {
  overview: () => apiClient.get<OverviewResponse>('/subscription/overview'),
  plans: () => apiClient.get<PlanResponse[]>('/subscription/plans'),
  /** Une nouvelle demande remplace celle qui était en attente. */
  requestChange: (planCode: string, message?: string) =>
    apiClient.post<ChangeRequestResponse>('/subscription/change-requests', { planCode, ...(message?.trim() ? { message: message.trim() } : {}) }),
  cancelRequest: (id: string) => apiClient.delete<void>(`/subscription/change-requests/${encodeURIComponent(id)}`),
}
