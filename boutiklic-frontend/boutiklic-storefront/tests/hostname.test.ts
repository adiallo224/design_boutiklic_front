import { describe, expect, it } from 'vitest'
import { normalizeHost, resolveSiteHost } from '../lib/hostname'

describe('normalizeHost', () => {
  it('met en minuscules, retire le port et le point final', () => {
    expect(normalizeHost('Ma-Boutique.BOUTIKLIC.com:443')).toBe('ma-boutique.boutiklic.com')
    expect(normalizeHost('boutique.example.org.')).toBe('boutique.example.org')
  })
  it.each([null, undefined, '', ' ', 'a b.com', 'evil.com/path', 'evil.com\r\nX-Tenant-ID: 1', 'a..b.com', '-a.com', 'a-.com', 'ex ample.com', 'http://x.com', 'x.com?y=1', 'x.com#f', '$(id).com', 'a'.repeat(64) + '.com'])(
    'refuse %j',
    (raw) => expect(normalizeHost(raw as string)).toBeNull(),
  )
  it('accepte un nom court (développement)', () => expect(normalizeHost('localhost:3000')).toBe('localhost'))
})

describe('resolveSiteHost', () => {
  it("l'hôte de développement remplace l'hôte demandé, s'il est défini et valable", () => {
    expect(resolveSiteHost('localhost:3000', 'demo.boutiklic.com')).toBe('demo.boutiklic.com')
  })
  it("sans hôte de développement (production), seul l'hôte demandé compte", () => {
    expect(resolveSiteHost('Boutique.com', undefined)).toBe('boutique.com')
    expect(resolveSiteHost('Boutique.com', '')).toBe('boutique.com')
  })
  it("un hôte de développement invalide n'est pas utilisé", () => {
    expect(resolveSiteHost('boutique.com', 'x y')).toBe('boutique.com')
  })
  it("rien de valable = null (jamais d'appel au core)", () => expect(resolveSiteHost('bad host', null)).toBeNull())
})
