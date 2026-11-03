/**
 * Proxy de la vitrine vers l'API publique du core. Le navigateur n'appelle QUE la vitrine (même origine: pas de CORS, pas de domaine d'API à exposer par boutique); la vitrine
 * relaie vers le gateway en conservant le nom d'hôte du visiteur. Liste blanche stricte: tout ce qui n'est pas explicitement prévu est refusé ici, avant le réseau.
 */
import { normalizeHost } from './hostname'
import { upstreamFetch } from './upstream'

type Method = 'GET' | 'POST'

/** Routes de l'API publique que le navigateur a le droit d'atteindre, par méthode. Les segments variables ne contiennent ni « / » ni caractère spécial. */
const SEGMENT = '[A-Za-z0-9_-]{1,64}'
const ALLOWED: Record<Method, RegExp[]> = {
  GET: [
    /^public\/storefront$/,
    /^public\/products$/,
    new RegExp(`^public/products/${SEGMENT}$`),
    /^public\/delivery$/,
    /^public\/delivery\/quote$/,
    new RegExp(`^public/orders/${SEGMENT}$`),
  ],
  POST: [/^public\/checkout\/quote$/, /^public\/checkout\/orders$/, new RegExp(`^public/orders/${SEGMENT}/cancel$`)],
}

export const MAX_BODY_BYTES = 32 * 1024

/** Chemin relatif à l'API (« public/products/abc »), ou null s'il n'est pas autorisé. */
export function allowedPath(method: string, segments: string[]): string | null {
  if (method !== 'GET' && method !== 'POST') return null
  if (segments.some((s) => s === '' || s === '.' || s === '..' || /[\\/%?#]/.test(s))) return null
  const path = segments.join('/')
  return ALLOWED[method].some((re) => re.test(path)) ? path : null
}

/** Dernière entrée de X-Forwarded-For : celle que pose le reverse proxy de confiance (Caddy). Les entrées précédentes peuvent avoir été forgées par le client. */
export function visitorIp(xForwardedFor: string | null | undefined): string | null {
  if (!xForwardedFor) return null
  const last = xForwardedFor.split(',').pop()?.trim()
  return last && /^[0-9a-fA-F:.]{3,45}$/.test(last) ? last : null
}

export interface ProxyConfig {
  gatewayUrl: string
  /** Nom d'hôte de test (STOREFRONT_DEV_HOST). Absent en production. */
  devHost?: string | null
  fetchImpl?: (url: string, init: { method: string; headers: Headers; body?: ArrayBuffer }) => Promise<Response>
}

const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'idempotency-key']

function problem(status: number, detail: string): Response {
  return new Response(JSON.stringify({ status, detail }), { status, headers: { 'content-type': 'application/problem+json', 'cache-control': 'no-store' } })
}

/**
 * Relaie une requête du navigateur vers le core. Ne transmet QUE: le nom d'hôte validé, le type de contenu, la langue, l'Idempotency-Key et l'IP du visiteur. Cookies,
 * Authorization, X-Tenant-ID, X-Client-IP et tout autre en-tête fourni par le navigateur sont abandonnés.
 */
export async function proxyRequest(request: Request, segments: string[], config: ProxyConfig): Promise<Response> {
  const path = allowedPath(request.method, segments)
  if (!path) return problem(404, 'Introuvable')

  const host = normalizeHost(config.devHost) ?? normalizeHost(request.headers.get('host'))
  if (!host) return problem(400, 'Hôte invalide')

  let body: ArrayBuffer | undefined
  if (request.method === 'POST') {
    body = await request.arrayBuffer()
    if (body.byteLength > MAX_BODY_BYTES) return problem(413, 'Requête trop volumineuse')
  }

  const headers = new Headers({ host })
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const ip = visitorIp(request.headers.get('x-forwarded-for'))
  if (ip) headers.set('x-forwarded-for', ip)

  const query = new URL(request.url).search
  const target = `${config.gatewayUrl.replace(/\/+$/, '')}/api/v1/${path}${query}`
  let upstream: Response
  try {
    upstream = await (config.fetchImpl ?? upstreamFetch)(target, { method: request.method, headers, body })
  } catch {
    return problem(502, 'Service momentanément indisponible')
  }

  const responseHeaders = new Headers({ 'cache-control': 'no-store', 'referrer-policy': 'no-referrer' })
  const contentType = upstream.headers.get('content-type')
  if (contentType) responseHeaders.set('content-type', contentType)
  const retryAfter = upstream.headers.get('retry-after')
  if (retryAfter) responseHeaders.set('retry-after', retryAfter)
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders })
}
