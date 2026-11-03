import AsyncStorage from '@react-native-async-storage/async-storage'
import { getAccessToken, getActiveTenantId, getRefreshToken, updateTokens, clearSession, notifyAuthChanged } from './session'
import { getDeviceId } from './device'
import i18n from '../i18n'

/** Base des routes REST du core, derrière la gateway. Pas de proxy Metro comme Vite en dev :
 * pointer directement sur la gateway (voir .env.example pour les valeurs par device/simulateur). */
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'

/** Sans ça, un fetch sur un réseau "connecté" mais mort (portail captif, wifi sans internet)
 * ne se termine jamais : ni succès ni 401/erreur, donc aucun mécanisme de reprise (retry outbox,
 * bannière offline) ne se déclenche. Le call reste simplement en attente indéfiniment. */
const REQUEST_TIMEOUT_MS = 8000

function fetchWithTimeout(input: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

export class ApiError extends Error {
  status: number
  errorCode?: string

  constructor(message: string, status: number, errorCode?: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errorCode = errorCode
  }
}

/** Requête jamais arrivée à un serveur (coupure, timeout) — distinct d'ApiError (serveur a
 *  répondu, mais en erreur) pour ne jamais confondre une coupure réseau avec une session
 *  vraiment invalide (cf. request : seul un 401 explicite après refresh doit déconnecter). */
export class NetworkError extends Error {
  constructor() {
    super('Connexion au serveur impossible')
    this.name = 'NetworkError'
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  /** Surcharge le token porteur par défaut (session active) — utilisé pendant l'onboarding,
   * avant que la session ne soit persistée. Désactive aussi le rafraîchissement automatique. */
  token?: string
  /** Surcharge le X-Tenant-ID par défaut (boutique active) — nécessaire seulement pour agir sur
   * une boutique différente de celle actuellement sélectionnée. */
  tenantId?: string
  body?: unknown
}

/** Réponse d'erreur RFC 7807 renvoyée par GlobalExceptionHandler/IdentityExceptionHandler côté core. */
interface ProblemDetailBody {
  title?: string
  detail?: string
  errorCode?: string
}

interface RawRefreshResponse {
  accessToken: string
  refreshToken: string
}

type RefreshOutcome =
  | { status: 'ok'; accessToken: string }
  | { status: 'invalid' }
  | { status: 'network-error' }

let refreshPromise: Promise<RefreshOutcome> | null = null

/** Rafraîchit l'access token via /identity/auth/refresh — appel fetch brut (hors `request`) pour
 * ne jamais passer par l'intercepteur 401 lui-même. Les 401 concurrents partagent le même refresh.
 * Distingue explicitement une coupure réseau (session à préserver, on retentera plus tard) d'un
 * refresh token vraiment invalide (session à clore) — sinon une micro-coupure pendant le refresh
 * déconnecterait le commerçant en pleine vente pour rien (cf. plan offline-first, Phase 0). */
function refreshAccessToken(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    refreshPromise = (async (): Promise<RefreshOutcome> => {
      const refreshToken = await getRefreshToken()
      if (!refreshToken) return { status: 'invalid' }
      const deviceId = await getDeviceId()

      let response: Response
      try {
        response = await fetchWithTimeout(`${API_BASE}/identity/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId, refreshToken }),
        })
      } catch {
        return { status: 'network-error' }
      }

      if (!response.ok) return { status: 'invalid' }
      const data = (await response.json()) as RawRefreshResponse
      await updateTokens(data.accessToken, data.refreshToken)
      return { status: 'ok', accessToken: data.accessToken }
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { token, tenantId, body, headers, ...rest } = options
  const authToken = token ?? (await getAccessToken())
  const activeTenantId = tenantId ?? (await getActiveTenantId())
  const isFormData = body instanceof FormData

  let response: Response
  try {
    response = await fetchWithTimeout(`${API_BASE}${path}`, {
      ...rest,
      headers: {
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        'Accept-Language': i18n.language,
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(activeTenantId ? { 'X-Tenant-ID': activeTenantId } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
    })
  } catch {
    throw new NetworkError()
  }

  // Session expirée : seulement pour les requêtes utilisant le token de session ambiant
  // (pas les tokens explicites de l'onboarding, pas un retry déjà tenté).
  const isSessionExpiry = response.status === 401 && !isRetry && !token && !!authToken
  if (isSessionExpiry) {
    const outcome = await refreshAccessToken()
    if (outcome.status === 'ok') {
      return request<T>(path, options, true)
    }
    if (outcome.status === 'network-error') {
      // Impossible de savoir si le token est encore valide : on préserve la session (pas de
      // déconnexion forcée) et on laisse l'appelant retenter (cf. outbox, qui traite toute
      // erreur non-ApiError comme une coupure réseau et retente plus tard).
      throw new NetworkError()
    }
    // Le refresh token n'est plus valide : device révoqué (ex. reset de mot de passe ailleurs,
    // cf. AuthCommandService.resetPassword) ou session expirée. Le flag permet à l'écran de
    // connexion d'expliquer la déconnexion plutôt que de la laisser passer pour un bug silencieux.
    await AsyncStorage.setItem('boutiklic_forced_logout', '1')
    await clearSession()
    notifyAuthChanged()
  }

  if (response.status === 204) {
    return undefined as T
  }

  const isJson = response.headers.get('content-type')?.includes('json') ?? false
  const payload = isJson ? await response.json().catch(() => null) : null

  if (!response.ok) {
    const problem = payload as ProblemDetailBody | null
    const message = problem?.detail ?? problem?.title ?? `Une erreur est survenue (${response.status})`
    throw new ApiError(message, response.status, problem?.errorCode)
  }

  return payload as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}

/** Message lisible à afficher à l'utilisateur, quelle que soit la nature de l'erreur.
 *  Erreurs API : message déjà résolu côté serveur dans la langue courante (cf. Accept-Language
 *  ci-dessus). Erreurs réseau/inattendues (pas de réponse serveur) : message local traduit. */
export function toErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof NetworkError) return error.message
  return i18n.t('common.errorGeneric')
}
