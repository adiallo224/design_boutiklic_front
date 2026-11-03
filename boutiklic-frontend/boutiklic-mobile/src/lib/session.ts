import AsyncStorage from '@react-native-async-storage/async-storage'
import type { AuthSessionResponse } from './authApi'
import { emitter } from './eventBus'
import i18n from '../i18n'

const KEYS = {
  accessToken: 'boutiklic_token',
  refreshToken: 'boutiklic_refresh_token',
  deviceId: 'boutiklic_device_id',
  userId: 'boutiklic_user_id',
  role: 'boutiklic_role',
  activeTenantId: 'boutiklic_active_tenant_id',
  shopCreated: 'boutiklic_shop_created',
} as const

export const AUTH_CHANGED_EVENT = 'boutiklic_auth_changed'

/** À appeler après tout changement de session (login/logout/refresh/switch boutique), pour que
 * useAuth (qui ne relit pas le storage à chaque render) recalcule son état. */
export function notifyAuthChanged() {
  emitter.emit(AUTH_CHANGED_EVENT)
}

/** Persiste la session émise par register/login — consommé par useAuth (boutiklic_token). */
export async function persistSession(session: AuthSessionResponse, tenantId: string) {
  await AsyncStorage.multiSet([
    [KEYS.accessToken, session.accessToken],
    [KEYS.refreshToken, session.refreshToken],
    [KEYS.deviceId, session.deviceId],
    [KEYS.userId, session.userId],
    [KEYS.role, session.role],
    [KEYS.activeTenantId, tenantId],
    [KEYS.shopCreated, 'true'],
  ])
}

/** Remplace uniquement les tokens (refresh silencieux, ou bascule de boutique) sans toucher au reste. */
export async function updateTokens(accessToken: string, refreshToken: string) {
  await AsyncStorage.multiSet([
    [KEYS.accessToken, accessToken],
    [KEYS.refreshToken, refreshToken],
  ])
}

export async function setActiveTenantId(tenantId: string) {
  await AsyncStorage.setItem(KEYS.activeTenantId, tenantId)
}

export function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.accessToken)
}

export function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.refreshToken)
}

export function getActiveTenantId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.activeTenantId)
}

export function getUserId(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.userId)
}

export function getUserRole(): Promise<string | null> {
  return AsyncStorage.getItem(KEYS.role)
}

/** Efface la session du compte courant (déconnexion, ou refresh token expiré/révoqué).
 * Ne touche pas à l'identité de l'appareil (device_id) ni au flag d'onboarding — propres à
 * l'appareil, pas au compte. */
export async function clearSession() {
  await AsyncStorage.multiRemove([
    KEYS.accessToken,
    KEYS.refreshToken,
    KEYS.userId,
    KEYS.role,
    KEYS.activeTenantId,
    KEYS.shopCreated,
  ])
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

/** Pont entre l'écran OTP (AuthFlow, route /login) et la création de boutique (route /create-shop).
 * Sur RN il n'y a pas de sessionStorage : mêmes clés, mais persistées dans AsyncStorage. */
export async function storePendingSignup(data: PendingSignup) {
  await AsyncStorage.multiSet([
    [PENDING_KEYS[0], data.onboardingToken],
    [PENDING_KEYS[1], data.phone ?? ''],
    [PENDING_KEYS[2], data.password],
    [PENDING_KEYS[3], data.displayName],
  ])
}

export async function readPendingSignup(): Promise<PendingSignup | null> {
  const entries = await AsyncStorage.multiGet(PENDING_KEYS)
  const map = Object.fromEntries(entries) as Record<(typeof PENDING_KEYS)[number], string | null>
  const onboardingToken = map[PENDING_KEYS[0]]
  const password = map[PENDING_KEYS[2]]
  if (!onboardingToken || !password) return null
  return {
    onboardingToken,
    phone: map[PENDING_KEYS[1]] || null,
    password,
    displayName: map[PENDING_KEYS[3]] || i18n.t('settings.role.owner'),
  }
}

export async function clearPendingSignup() {
  await AsyncStorage.multiRemove(PENDING_KEYS)
}
