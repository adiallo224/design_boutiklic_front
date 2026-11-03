import type { AuthSessionResponse } from './authApi'
import i18n from '../i18n'

const KEYS = {
  accessToken: 'boutiklic_token',
  refreshToken: 'boutiklic_refresh_token',
  deviceId: 'boutiklic_device_id',
  userId: 'boutiklic_user_id',
  role: 'boutiklic_role',
  activeTenantId: 'boutiklic_active_tenant_id',
  shopCreated: 'boutiklic_shop_created',
  lastKnownShop: 'boutiklic_last_known_shop',
} as const

export const AUTH_CHANGED_EVENT = 'boutiklic_auth_changed'

/** À appeler après tout changement de session (login/logout/refresh/switch boutique), pour que
 * useAuth (qui ne relit pas le storage à chaque render) recalcule son état. */
export function notifyAuthChanged() {
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

/** Persiste la session émise par register/login — consommé par useAuth (boutiklic_token). */
export function persistSession(session: AuthSessionResponse, tenantId: string) {
  localStorage.setItem(KEYS.accessToken, session.accessToken)
  localStorage.setItem(KEYS.refreshToken, session.refreshToken)
  localStorage.setItem(KEYS.deviceId, session.deviceId)
  localStorage.setItem(KEYS.userId, session.userId)
  localStorage.setItem(KEYS.role, session.role)
  localStorage.setItem(KEYS.activeTenantId, tenantId)
  localStorage.setItem(KEYS.shopCreated, 'true')
}

/** Remplace uniquement les tokens (refresh silencieux, ou bascule de boutique) sans toucher au reste. */
export function updateTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(KEYS.accessToken, accessToken)
  localStorage.setItem(KEYS.refreshToken, refreshToken)
}

export function setActiveTenantId(tenantId: string) {
  localStorage.setItem(KEYS.activeTenantId, tenantId)
}

export function getAccessToken(): string | null {
  return localStorage.getItem(KEYS.accessToken)
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(KEYS.refreshToken)
}

export function getActiveTenantId(): string | null {
  return localStorage.getItem(KEYS.activeTenantId)
}

export function getUserId(): string | null {
  return localStorage.getItem(KEYS.userId)
}

export function getUserRole(): string | null {
  return localStorage.getItem(KEYS.role)
}

/** Efface la session du compte courant (déconnexion, ou refresh token expiré/révoqué).
 * Ne touche pas à l'identité de l'appareil (device_id) ni au flag d'onboarding — propres à
 * l'appareil, pas au compte. Ne touche pas non plus lastKnownShop (cf. plus bas), pour la même
 * raison. */
export function clearSession() {
  localStorage.removeItem(KEYS.accessToken)
  localStorage.removeItem(KEYS.refreshToken)
  localStorage.removeItem(KEYS.userId)
  localStorage.removeItem(KEYS.role)
  localStorage.removeItem(KEYS.activeTenantId)
  localStorage.removeItem(KEYS.shopCreated)
}

export interface LastKnownShop {
  id: string
  name: string
  city: string | null
}

/** Repère purement local à cet appareil/terminal (jamais transmis au serveur) : quelle boutique y a
 * été utilisée en dernier, pour l'affichage "Boutique active : ..." sur l'écran de connexion
 * (AuthDesktopShell). Distinct de activeTenantId ci-dessus, qui sert à accélérer la résolution de
 * connexion côté serveur — celui-ci ne sert qu'à l'affichage et survit intentionnellement à la
 * déconnexion, comme device_id. Alimenté par useTenant() dès qu'un nom de boutique est résolu
 * (connexion, création, changement de boutique). */
export function setLastKnownShop(shop: LastKnownShop) {
  localStorage.setItem(KEYS.lastKnownShop, JSON.stringify(shop))
}

export function getLastKnownShop(): LastKnownShop | null {
  const raw = localStorage.getItem(KEYS.lastKnownShop)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      return { id: parsed.id, name: parsed.name, city: typeof parsed.city === 'string' ? parsed.city : null }
    }
  } catch {
    // ignore malformed value
  }
  return null
}

export function clearLastKnownShop() {
  localStorage.removeItem(KEYS.lastKnownShop)
}

const PENDING_KEYS = [
  'boutiklic_pending_onboarding_token',
  'boutiklic_pending_phone',
  'boutiklic_pending_password',
  'boutiklic_pending_name',
] as const

export interface PendingSignup {
  onboardingToken: string
  /** Absent pour une inscription par email. */
  phone: string | null
  password: string
  displayName: string
}

/** Pont entre l'écran OTP (AuthFlow, route /login) et la création de boutique (route /create-shop) —
 * deux composants distincts côté router, sessionStorage évite de faire remonter cet état dans App.tsx. */
export function storePendingSignup(data: PendingSignup) {
  sessionStorage.setItem(PENDING_KEYS[0], data.onboardingToken)
  sessionStorage.setItem(PENDING_KEYS[1], data.phone ?? '')
  sessionStorage.setItem(PENDING_KEYS[2], data.password)
  sessionStorage.setItem(PENDING_KEYS[3], data.displayName)
}

export function readPendingSignup(): PendingSignup | null {
  const [onboardingToken, phone, password, displayName] = PENDING_KEYS.map((key) => sessionStorage.getItem(key))
  if (!onboardingToken || !password) return null
  return { onboardingToken, phone: phone || null, password, displayName: displayName || i18n.t('settings.role.owner') }
}

export function clearPendingSignup() {
  PENDING_KEYS.forEach((key) => sessionStorage.removeItem(key))
}
