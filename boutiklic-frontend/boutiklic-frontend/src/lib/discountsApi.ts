import { apiClient } from './apiClient'

export type DiscountType = 'PERCENTAGE' | 'AMOUNT'
export type DiscountReason = 'LOYAL_CUSTOMER' | 'PRODUCT_DEFECT' | 'NEGOTIATION' | 'PRICING_ERROR' | 'OTHER'

export interface DiscountResponse {
  id: string
  saleId: string
  saleLineId: string | null
  type: DiscountType
  value: number
  originalAmount: number
  amount: number
  currency: string
  reason: DiscountReason
  reasonNote: string | null
  grantedBy: string
  approvalRequired: boolean
  approvedBy: string | null
  approvalMethod: 'SELF' | 'PASSWORD_RELAY' | null
  createdAt: string
}

export interface GrantDiscountRequest {
  /** Absent = rabais sur tout le panier. Renseigné = rabais sur une ligne précise. */
  saleLineId?: string
  type: DiscountType
  value: number
  reason: DiscountReason
  reasonNote?: string
  /** Relais gérant (écran B3) — requis seulement si le vendeur dépasse le seuil et n'est pas OWNER.
   * Un premier essai sans ce champ renvoie 422 SALE_002 ; un mot de passe erroné renvoie 422 SALE_003. */
  managerPassword?: string
}

/** Lancée côté écran (jamais par le backend) quand un rabais nécessite le relais gérant — la modale
 * de mot de passe prend le relais, `SaleValidation` doit juste réarmer son bouton sans afficher d'erreur. */
export class ManagerApprovalPendingError extends Error {}

/**
 * Client typé du module sale/rabais — cf. boutiklic-core SaleController (écran B3, bouton Rabais).
 * Un rabais qui dépasse le seuil autorisé pour un vendeur (20%) déclenche le relais gérant (mot de
 * passe du propriétaire, `managerPassword`) géré par CashierFlow — cf. ManagerApprovalModal.
 */
export const discountsApi = {
  grant: (saleId: string, payload: GrantDiscountRequest) =>
    apiClient.post<DiscountResponse>(`/sales/${saleId}/discounts`, payload),

  getBySale: (saleId: string) => apiClient.get<DiscountResponse[]>(`/sales/${saleId}/discounts`),
}
