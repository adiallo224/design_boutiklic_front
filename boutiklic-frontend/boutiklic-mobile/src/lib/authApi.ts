import { apiClient } from './apiClient'
import type { CostMethod } from '@boutiklic/shared'

/** +224 par défaut (marché cible v1, cf. study/BOUTIKLIC Interfaces.dc.md) — le champ ne saisit
 *  que les chiffres locaux. dialCode sélectionnable depuis Login/CreateAccount (cf. CountryCodePicker) ;
 *  les autres écrans (dette, consignation, réglages) restent sur le défaut +224. */
export function toE164Phone(localDigits: string, dialCode: string = '+224'): string {
  // Le préfixe de tronc national ("0") ne fait pas partie du format E.164.
  return `${dialCode}${localDigits.replace(/^0+/, '')}`
}

export interface TenantMembership {
  tenantId: string
  role: string
  credentialAlreadySet: boolean
  hasRecoveryPin: boolean
}

export interface VerifyOtpResponse {
  onboardingToken: string
  existingMemberships: TenantMembership[]
}

export interface AuthSessionResponse {
  accessToken: string
  refreshToken: string
  deviceId: string
  userId: string
  role: string
  tenantId: string
}

export interface TenantResponse {
  id: string
  name: string
  phone: string | null
  city: string
  neighborhood: string | null
  businessSector: string | null
  shopSize: string
  logoUrl: string | null
  latitude: number | null
  longitude: number | null
  locationAccuracyMeters: number | null
  currency: string
  subscriptionType: string
  subscriptionExpiresAt: string | null
  active: boolean
  discountApprovalThresholdPercent: number
  multiDepotEnabled: boolean
  /** TVA appliquée aux ventes et catégorie fiscale par défaut de la boutique — absents chez un serveur ancien. */
  taxEnabled?: boolean
  defaultTaxCategoryId?: string | null
  /** Code ISO du pays de la boutique (taux de TVA officiels) — absent chez un serveur ancien. */
  country?: string | null
  /** Précision des prix de vente unitaires (0 à 2 décimales), réglage propriétaire — indépendante de la devise (étude prix
   *  décimaux, phase 5bis). Les montants encaissés suivent la devise, pas ce réglage. */
  sellingPriceDecimals: number
  /** Ce qu'un arrivage fait au coût d'achat des articles (étude prix décimaux, section 11) — absent chez un serveur ancien : MANUAL. */
  costMethod?: string
  createdAt: string
}

interface DeviceInfo {
  deviceId: string
  deviceName: string
  platform: string
}

/** Client typé du module identity/tenant — cf. boutiklic-core AuthController/TenantController. */
export const authApi = {
  requestOtp: (phone: string) => apiClient.post<void>('/identity/otp/request', { phone }),

  verifyOtp: (phone: string, code: string) =>
    apiClient.post<VerifyOtpResponse>('/identity/otp/verify', { phone, code }),

  requestOtpEmail: (email: string) => apiClient.post<void>('/identity/otp/request-email', { email }),

  verifyOtpEmail: (email: string, code: string) =>
    apiClient.post<VerifyOtpResponse>('/identity/otp/verify-email', { email, code }),

  completeRegistration: (payload: {
    onboardingToken: string
    tenantId: string
    password: string
    displayName: string
  } & DeviceInfo) => apiClient.post<AuthSessionResponse>('/identity/auth/register', payload),

  /** `tenantId` optionnel : si absent (appareil sans boutique connue en cache), le backend résout
   *  le compte par téléphone/email + mot de passe sur toutes les boutiques (cf. AuthCommandService.login). */
  login: (payload: { tenantId?: string; phone?: string; email?: string; password: string } & DeviceInfo) =>
    apiClient.post<AuthSessionResponse>('/identity/auth/login', payload),

  /** `tenantId` optionnel : si absent, résolu par identifiant seul sur toutes les boutiques
   *  (cf. AuthCommandService.resolveActivatedUserAcrossTenants) — même logique que `login`.
   *  `recoveryPin` exigé seulement si le compte en a configuré un (cf. TenantMembership.hasRecoveryPin). */
  resetPassword: (payload: { onboardingToken: string; tenantId?: string; password: string; recoveryPin?: string } & DeviceInfo) =>
    apiClient.post<AuthSessionResponse>('/identity/auth/reset-password', payload),

  /** Écran Sécurité : le compte courant a-t-il déjà configuré un code de récupération ? */
  getRecoveryPinStatus: () => apiClient.get<{ configured: boolean }>('/identity/auth/recovery-pin/status'),

  /** Configure/remplace le code de récupération — confirmation par mot de passe actuel obligatoire côté serveur. */
  setRecoveryPin: (currentPassword: string, pin: string) =>
    apiClient.post<void>('/identity/auth/recovery-pin', { currentPassword, pin }),

  /** Retour au reset par OTP seul — même confirmation par mot de passe actuel. */
  disableRecoveryPin: (currentPassword: string) =>
    apiClient.delete<void>('/identity/auth/recovery-pin', { body: { currentPassword } }),

  /** Suppression définitive du compte (anonymisation côté serveur) — confirmation par mot de passe actuel. */
  deleteAccount: (currentPassword: string) =>
    apiClient.delete<void>('/identity/auth/account', { body: { currentPassword } }),

  refresh: (deviceId: string, refreshToken: string) =>
    apiClient.post<{ accessToken: string; refreshToken: string }>('/identity/auth/refresh', { deviceId, refreshToken }),

  /** Révoque cet appareil (invalide son refresh token côté serveur, cf. Device.revoke) — à appeler
   *  à la déconnexion (écran Réglages, "Se déconnecter") avant d'effacer la session locale. */
  revokeDevice: (deviceId: string) => apiClient.delete<void>(`/identity/devices/${deviceId}`),

  createTenant: (payload: { name: string; phone?: string; city: string; currency: string; applyTax?: boolean }) =>
    apiClient.post<TenantResponse>('/tenants', payload),

  /** `token` optionnel : explicite pendant l'onboarding (session pas encore persistée), sinon
   *  apiClient utilise le token de session ambiant (F1, ShopProfile). */
  updateTenantIdentity: (
    tenantId: string,
    payload: { name: string; city: string; neighborhood?: string; logoUrl?: string },
    token?: string
  ) => apiClient.patch<TenantResponse>(`/tenants/${tenantId}/identity`, payload, { token }),

  /** Position GPS de la boutique (écran A5, bouton "Localiser") — `token` optionnel, mirror
   *  d'updateTenantIdentity (appelé pendant l'onboarding, avant que la session ne soit persistée). */
  relocateTenant: (
    tenantId: string,
    payload: { latitude: number; longitude: number; accuracyMeters: number },
    token?: string
  ) => apiClient.patch<TenantResponse>(`/tenants/${tenantId}/location`, payload, { token }),

  completeOnboarding: (
    tenantId: string,
    payload: { businessSector: string; shopSize: string },
    token?: string
  ) => apiClient.patch<TenantResponse>(`/tenants/${tenantId}/onboarding`, payload, { token }),

  changeShopSize: (tenantId: string, shopSize: 'PETITE' | 'MOYENNE' | 'GRANDE') =>
    apiClient.patch<TenantResponse>(`/tenants/${tenantId}/shop-size`, { shopSize }),

  /** Pays de la boutique (code ISO) : pilote les taux de TVA officiels proposés. Réservé au propriétaire. */
  changeCountry: (tenantId: string, country: string) =>
    apiClient.patch<TenantResponse>(`/tenants/${tenantId}/country`, { country }),

  getTenant: (tenantId: string) => apiClient.get<TenantResponse>(`/tenants/${tenantId}`),

  /** Nom + logo d'une boutique, sans authentification (écran A3e, invité pas encore activé —
   *  seul un onboardingToken en poche, pas de rôle sur ce tenant pour appeler getTenant). */
  getTenantInviteSummary: (tenantId: string) =>
    apiClient.get<{ name: string; logoUrl: string | null }>(`/tenants/${tenantId}/invite-summary`),

  /** Liste des boutiques du compte courant, toutes boutiques confondues (actives et archivées) —
   *  écran F0, "Mes boutiques". */
  listMyBoutiques: () => apiClient.get<{ tenantId: string; role: string; active: boolean }[]>('/identity/auth/boutiques'),

  /** Bascule la session courante vers une autre boutique du même compte (écran F0, "Basculer"). */
  switchBoutique: (tenantId: string, device: DeviceInfo) =>
    apiClient.post<AuthSessionResponse>(`/identity/auth/boutiques/${tenantId}/switch`, device),

  /** Rattache le compte courant (déjà OWNER) comme propriétaire d'une boutique fraîchement créée
   *  via createTenant (écran F0, "+ Créer une boutique"). */
  attachBoutique: (tenantId: string, device: DeviceInfo) =>
    apiClient.post<AuthSessionResponse>(`/identity/auth/boutiques/${tenantId}/attach`, device),

  /** Archive/réactive une boutique (écran F0) — ne supprime rien, masque juste l'accès du compte courant. */
  archiveBoutique: (tenantId: string) => apiClient.patch<void>(`/identity/auth/boutiques/${tenantId}/archive`),
  unarchiveBoutique: (tenantId: string) => apiClient.patch<void>(`/identity/auth/boutiques/${tenantId}/unarchive`),

  /** Seuil de rabais sans validation gérant (écran F3, propriétaire uniquement). */
  changeDiscountThreshold: (tenantId: string, thresholdPercent: number) =>
    apiClient.patch<TenantResponse>(`/tenants/${tenantId}/discount-threshold`, { thresholdPercent }),

  /** Méthode de coût à l'arrivage (étude prix décimaux, section 11) — propriétaire uniquement. */
  changeCostMethod: (tenantId: string, costMethod: CostMethod) =>
    apiClient.patch<TenantResponse>(`/tenants/${tenantId}/cost-method`, { costMethod }),
}
