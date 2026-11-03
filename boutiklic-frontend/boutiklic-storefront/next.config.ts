import path from 'node:path'
import type { NextConfig } from 'next'

// La vitrine lit `packages/shared` (TypeScript pur, publié en source) par chemin relatif, sans passer par les workspaces npm de la racine.
// La racine de compilation doit donc remonter jusqu'au dépôt, sinon Next refuse de lire un fichier hors de son dossier.
const repoRoot = path.join(__dirname, '..')

const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : ''

const securityHeaders = [
  // Pas de script tiers, sauf le captcha quand il est activé. 'unsafe-inline' pour les scripts d'amorçage de Next (pas de nonce au MVP).
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${turnstile}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' https: data:",
      `connect-src 'self'${turnstile}`,
      `frame-src${turnstile || " 'none'"}`,
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
]

const nextConfig: NextConfig = {
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  // Image Docker minimale (serveur autonome).
  output: 'standalone',
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Le lien de suivi contient un jeton: il ne doit JAMAIS partir en référent vers un autre site.
      { source: '/order/:path*', headers: [{ key: 'Referrer-Policy', value: 'no-referrer' }, { key: 'Cache-Control', value: 'no-store' }] },
      { source: '/cart', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
      { source: '/checkout', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

export default nextConfig
