/**
 * Nom d'hôte demandé par le visiteur. C'est LUI, et lui seul, qui désigne la boutique côté core: il est donc validé strictement avant d'être transmis (jamais d'espace, de
 * caractère de contrôle ni de séparateur: pas d'injection d'en-tête, pas de requête vers un hôte inattendu).
 */
const HOSTNAME = /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/

/** Minuscules, sans port ni point final. Renvoie null si ce n'est pas un nom d'hôte valable. */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (!raw) return null
  // Seul un VRAI port (chiffres) est retiré: « http://x.com » ne doit pas devenir « http ».
  let host = raw.trim().toLowerCase().replace(/:\d{1,5}$/, '')
  if (host.endsWith('.')) host = host.slice(0, -1)
  return HOSTNAME.test(host) ? host : null
}

/**
 * Hôte envoyé au core. En développement local (localhost n'est la vitrine d'aucune boutique), `devHost` (STOREFRONT_DEV_HOST) joue le rôle du nom de domaine
 * d'une boutique de test. En production il n'est PAS défini : seul l'hôte réellement demandé compte.
 */
export function resolveSiteHost(requestHost: string | null | undefined, devHost?: string | null): string | null {
  return normalizeHost(devHost) ?? normalizeHost(requestHost)
}
