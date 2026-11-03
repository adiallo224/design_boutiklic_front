import { afterEach, describe, expect, it } from 'vitest'
import { MAX_BODY_BYTES, allowedPath, proxyRequest, visitorIp } from '../lib/proxy'
import { startFakeGateway } from './fakeGateway'

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

async function gateway(respond: Parameters<typeof startFakeGateway>[0] = () => ({ body: { ok: true } })) {
  const g = await startFakeGateway(respond)
  closers.push(g.close)
  return g
}

const req = (method: string, path: string, init: { headers?: Record<string, string>; body?: string } = {}) =>
  new Request('http://boutique.example.org/api/' + path, { method, headers: init.headers, body: init.body })

describe('liste blanche', () => {
  it.each([
    ['GET', 'public/storefront'], ['GET', 'public/products'], ['GET', 'public/products/abc-123'], ['GET', 'public/delivery'], ['GET', 'public/delivery/quote'],
    ['GET', 'public/orders/CMD-000001'], ['POST', 'public/checkout/quote'], ['POST', 'public/checkout/orders'], ['POST', 'public/orders/CMD-000001/cancel'],
  ])('autorise %s %s', (method, path) => expect(allowedPath(method, path.split('/'))).toBe(path))

  it.each([
    ['GET', 'storefronts'], ['GET', 'online-orders'], ['GET', 'identity/auth/login'], ['GET', 'actuator/health'], ['GET', 'public'], ['GET', 'public/products/a/b'],
    ['POST', 'public/products'], ['POST', 'public/storefront'], ['GET', 'public/checkout/orders'], ['GET', 'public/orders/x/cancel'],
    ['DELETE', 'public/orders/CMD-000001'], ['PUT', 'public/checkout/orders'], ['PATCH', 'public/storefront'],
    ['GET', 'public/../storefronts'], ['GET', 'public/products/..'], ['GET', 'public/products/a%2Fb'], ['GET', 'public//products'],
  ])('refuse %s %s', (method, path) => expect(allowedPath(method, path.split('/'))).toBeNull())
})

describe('adresse du visiteur', () => {
  it("prend la DERNIÈRE entrée de X-Forwarded-For (celle du reverse proxy de confiance), jamais une entrée forgée", () => {
    expect(visitorIp('6.6.6.6, 203.0.113.9')).toBe('203.0.113.9')
    expect(visitorIp('203.0.113.9')).toBe('203.0.113.9')
    expect(visitorIp('2001:db8::1')).toBe('2001:db8::1')
  })
  it.each([null, undefined, '', 'pas une ip', '1.2.3.4, <script>', 'a'.repeat(60)])('ignore %j', (v) => expect(visitorIp(v as string)).toBeNull())
})

describe('relais vers le gateway', () => {
  it("transmet l'hôte du visiteur en en-tête Host, et rien de ce qui touche à l'identité", async () => {
    const g = await gateway()
    const response = await proxyRequest(
      req('POST', 'public/checkout/quote', {
        headers: { host: 'Ma-Boutique.boutiklic.com', 'content-type': 'application/json', cookie: 'session=secret', authorization: 'Bearer volé', 'x-tenant-id': 'autre-boutique',
          'x-client-ip': '9.9.9.9', 'x-user-id': 'admin', 'x-forwarded-for': '6.6.6.6, 203.0.113.9', 'accept-language': 'fr', 'idempotency-key': 'abc' },
        body: '{"items":[]}',
      }),
      ['public', 'checkout', 'quote'],
      { gatewayUrl: g.url },
    )

    expect(response.status).toBe(200)
    const seen = g.requests[0]
    expect(seen.url).toBe('/api/v1/public/checkout/quote')
    expect(seen.headers.host).toBe('ma-boutique.boutiklic.com')
    expect(seen.headers['x-forwarded-for']).toBe('203.0.113.9')
    expect(seen.headers['idempotency-key']).toBe('abc')
    expect(seen.headers['content-type']).toBe('application/json')
    expect(seen.body).toBe('{"items":[]}')
    for (const forbidden of ['cookie', 'authorization', 'x-tenant-id', 'x-client-ip', 'x-user-id']) expect(seen.headers[forbidden], forbidden).toBeUndefined()
  })

  it("en développement, STOREFRONT_DEV_HOST remplace l'hôte (localhost n'est la vitrine d'aucune boutique)", async () => {
    const g = await gateway()
    await proxyRequest(req('GET', 'public/products', { headers: { host: 'localhost:3000' } }), ['public', 'products'], { gatewayUrl: g.url, devHost: 'demo.boutiklic.com' })
    expect(g.requests[0].headers.host).toBe('demo.boutiklic.com')
  })

  it("conserve la chaîne de requête (page, taille, jeton de suivi)", async () => {
    const g = await gateway()
    await proxyRequest(new Request('http://b.example.org/api/public/orders/CMD-000001?t=jeton', { headers: { host: 'b.example.org' } }), ['public', 'orders', 'CMD-000001'], { gatewayUrl: g.url })
    expect(g.requests[0].url).toBe('/api/v1/public/orders/CMD-000001?t=jeton')
  })

  it('un chemin refusé ne touche jamais le réseau', async () => {
    const g = await gateway()
    const response = await proxyRequest(req('GET', 'online-orders', { headers: { host: 'b.example.org' } }), ['online-orders'], { gatewayUrl: g.url })
    expect(response.status).toBe(404)
    expect(g.requests).toHaveLength(0)
  })

  it("refuse un nom d'hôte invalide sans appeler le gateway", async () => {
    const g = await gateway()
    const response = await proxyRequest(req('GET', 'public/products', { headers: { host: 'evil.com/../x' } }), ['public', 'products'], { gatewayUrl: g.url })
    expect(response.status).toBe(400)
    expect(g.requests).toHaveLength(0)
  })

  it('refuse un corps trop gros sans appeler le gateway', async () => {
    const g = await gateway()
    const response = await proxyRequest(req('POST', 'public/checkout/quote', { headers: { host: 'b.example.org' }, body: 'x'.repeat(MAX_BODY_BYTES + 1) }), ['public', 'checkout', 'quote'], { gatewayUrl: g.url })
    expect(response.status).toBe(413)
    expect(g.requests).toHaveLength(0)
  })

  it('relaie le statut et le corps du core tels quels, jamais mis en cache', async () => {
    const g = await gateway(() => ({ status: 409, body: { errorCode: 'PRICE_CHANGED', newTotal: 5600 }, headers: { 'retry-after': '3', 'set-cookie': 'a=b', 'x-interne': 'secret' } }))
    const response = await proxyRequest(req('POST', 'public/checkout/orders', { headers: { host: 'b.example.org' }, body: '{}' }), ['public', 'checkout', 'orders'], { gatewayUrl: g.url })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ errorCode: 'PRICE_CHANGED', newTotal: 5600 })
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('retry-after')).toBe('3')
    expect(response.headers.get('set-cookie')).toBeNull()
    expect(response.headers.get('x-interne')).toBeNull()
  })

  it('un gateway injoignable donne un 502 propre', async () => {
    const response = await proxyRequest(req('GET', 'public/products', { headers: { host: 'b.example.org' } }), ['public', 'products'], { gatewayUrl: 'http://127.0.0.1:1' })
    expect(response.status).toBe(502)
    expect((await response.json()).detail).not.toMatch(/ECONN|127\.0\.0\.1/)
  })
})
