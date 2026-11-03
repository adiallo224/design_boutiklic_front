/**
 * Appels de la vitrine vers l'API publique du core, via le gateway. Le nom d'hôte du visiteur est transmis en en-tête `Host` (le gateway le conserve, le core en déduit la
 * boutique). Aucun identifiant de boutique, jeton ni secret ne circule: l'API est anonyme.
 */
import { TtlCache } from './ttlCache'
import type { DeliveryOptions, ProblemDetail, ProductPage, PublicPage, PublicProduct, PublicStorefront } from './types'
import { upstreamFetch } from './upstream'

export class CoreError extends Error {
  constructor(readonly status: number, readonly problem: ProblemDetail | null) {
    super(problem?.detail ?? `Erreur ${status}`)
  }
}

export interface CoreConfig {
  gatewayUrl: string
  /** Pour les tests. Par défaut: appel HTTP qui respecte l'en-tête Host. */
  fetchImpl?: (url: string, init: { headers: Record<string, string> }) => Promise<Response>
  /** Pour les tests: cache dédié. Par défaut: le cache du processus. */
  cache?: TtlCache<unknown>
}

/** Les lectures publiques changent peu: 60 s, comme le Cache-Control du core. Un seul cache pour tout le processus; la clé contient l'hôte. */
const sharedCache = new TtlCache<unknown>(60_000)

export function coreConfig(): CoreConfig {
  return { gatewayUrl: (process.env.GATEWAY_URL ?? 'http://localhost:8080').replace(/\/+$/, '') }
}

export const readUrl = (config: CoreConfig, path: string): string => `${config.gatewayUrl}/api/v1${path}`

/** Clé de cache d'une lecture. L'hôte en fait partie: deux boutiques demandant la même route ne partagent JAMAIS une entrée, l'une ne voit pas le catalogue de l'autre. */
export const cacheKey = (host: string, path: string): string => `${host}|${path}`

async function read<T>(config: CoreConfig, host: string, path: string): Promise<T | null> {
  const cache = (config.cache ?? sharedCache) as TtlCache<T | null>
  return cache.get(cacheKey(host, path), async () => {
    const response = await (config.fetchImpl ?? upstreamFetch)(readUrl(config, path), { headers: { host, accept: 'application/json' } })
    // Une boutique inconnue ou non publiée se met en cache comme le reste (60 s): un visiteur qui insiste ne fait pas pression sur le core.
    if (response.status === 404) return null
    if (!response.ok) throw new CoreError(response.status, await response.json().catch(() => null))
    return (await response.json()) as T
  })
}

/** Null = adresse inconnue, boutique non publiée ou suspendue : le core répond pareil dans tous ces cas, la vitrine aussi. */
export const getStorefront = (config: CoreConfig, host: string) => read<PublicStorefront>(config, host, '/public/storefront')

export const getProducts = (config: CoreConfig, host: string, page = 0, size = 24) =>
  read<ProductPage>(config, host, `/public/products?page=${Math.max(0, page)}&size=${size}`)

export const getProduct = (config: CoreConfig, host: string, id: string) =>
  read<PublicProduct>(config, host, `/public/products/${encodeURIComponent(id)}`)

/** Contenu rédigé d'une page optionnelle (texte brut). Null = page inconnue, désactivée ou sans contenu. */
export const getPage = (config: CoreConfig, host: string, code: string) => read<PublicPage>(config, host, `/public/pages/${encodeURIComponent(code)}`)

export const getDelivery = (config: CoreConfig, host: string) => read<DeliveryOptions>(config, host, '/public/delivery')
