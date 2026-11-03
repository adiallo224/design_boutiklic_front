import { apiClient } from './apiClient'

/** Frais d'une zone : fixes, fixes gratuits au-delà d'un seuil, ou « à confirmer » (communiqués par téléphone). */
export type FeeType = 'FLAT' | 'FREE_ABOVE' | 'TO_CONFIRM'

export interface DeliveryZoneResponse {
  id: string
  name: string
  /** Villes ou quartiers couverts. */
  areas: string[]
  feeType: FeeType
  /** Nul pour des frais « à confirmer ». */
  fee: number | null
  /** Seuil de gratuité, seulement pour FREE_ABOVE. */
  freeAbove: number | null
  minOrder: number | null
  etaText: string | null
  active: boolean
  position: number
  createdAt: string
  updatedAt: string
}

export interface DeliveryZoneRequest {
  name: string
  areas: string[]
  feeType: FeeType
  fee?: number
  freeAbove?: number
  minOrder?: number
  etaText?: string
  active: boolean
  position?: number
}

export interface PickupPointResponse {
  id: string
  /** Dépôt de la boutique où se retire la commande (facultatif). */
  depotId: string | null
  name: string
  addressText: string
  latitude: number | null
  longitude: number | null
  hoursText: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface PickupPointRequest {
  depotId?: string
  name: string
  addressText: string
  latitude?: number
  longitude?: number
  hoursText?: string
  active: boolean
}

/** Plafonds du serveur (un site a au plus 50 zones et 20 points de retrait). */
export const MAX_ZONES = 50
export const MAX_PICKUP_POINTS = 20

const zones = (siteId: string) => `/storefronts/${encodeURIComponent(siteId)}/delivery-zones`
const pickups = (siteId: string) => `/storefronts/${encodeURIComponent(siteId)}/pickup-points`

/** Client typé de la livraison et du retrait d'un site — cf. boutiklic-core DeliveryController. */
export const deliveryApi = {
  listZones: (siteId: string) => apiClient.get<DeliveryZoneResponse[]>(zones(siteId)),
  createZone: (siteId: string, payload: DeliveryZoneRequest) => apiClient.post<DeliveryZoneResponse>(zones(siteId), payload),
  updateZone: (siteId: string, zoneId: string, payload: DeliveryZoneRequest) => apiClient.put<DeliveryZoneResponse>(`${zones(siteId)}/${encodeURIComponent(zoneId)}`, payload),
  deleteZone: (siteId: string, zoneId: string) => apiClient.delete<void>(`${zones(siteId)}/${encodeURIComponent(zoneId)}`),

  listPickupPoints: (siteId: string) => apiClient.get<PickupPointResponse[]>(pickups(siteId)),
  createPickupPoint: (siteId: string, payload: PickupPointRequest) => apiClient.post<PickupPointResponse>(pickups(siteId), payload),
  updatePickupPoint: (siteId: string, pickupPointId: string, payload: PickupPointRequest) =>
    apiClient.put<PickupPointResponse>(`${pickups(siteId)}/${encodeURIComponent(pickupPointId)}`, payload),
  deletePickupPoint: (siteId: string, pickupPointId: string) => apiClient.delete<void>(`${pickups(siteId)}/${encodeURIComponent(pickupPointId)}`),
}
