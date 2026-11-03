import { afterEach, describe, expect, it } from 'vitest'
import { CoreError, cacheKey, getProduct, getProducts, getStorefront, readUrl, type CoreConfig } from '../lib/core'
import { TtlCache } from '../lib/ttlCache'
import { startFakeGateway } from './fakeGateway'

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

const site = (name: string) => ({ name, locale: 'fr', contactPhone: null, contactWhatsapp: null, contactEmail: null })
/** Chaque test a son propre cache: aucun état partagé entre tests. */
const config = (gatewayUrl: string): CoreConfig => ({ gatewayUrl, cache: new TtlCache<unknown>(60_000) })

describe("client de l'API publique", () => {
  it("envoie le nom d'hôte du visiteur en Host (et pas celui du gateway) — le fetch de Node l'écraserait", async () => {
    const g = await startFakeGateway(() => ({ body: site('Ma boutique') }))
    closers.push(g.close)

    const found = await getStorefront(config(g.url), 'ma-boutique.boutiklic.com')

    expect(found?.name).toBe('Ma boutique')
    expect(g.requests[0].headers.host).toBe('ma-boutique.boutiklic.com')
    expect(g.requests[0].url).toBe('/api/v1/public/storefront')
  })

  it('deux boutiques ne partagent JAMAIS une entrée de cache, même route et même gateway', async () => {
    const g = await startFakeGateway((seen) => ({ body: site('Boutique de ' + seen.headers.host) }))
    closers.push(g.close)
    const shared = config(g.url)

    const a = await getStorefront(shared, 'a.boutiklic.com')
    const b = await getStorefront(shared, 'b.boutiklic.com')
    const aAgain = await getStorefront(shared, 'a.boutiklic.com')

    expect(a?.name).toBe('Boutique de a.boutiklic.com')
    expect(b?.name).toBe('Boutique de b.boutiklic.com')
    expect(aAgain?.name).toBe('Boutique de a.boutiklic.com')
    expect(g.requests).toHaveLength(2)
    expect(cacheKey('a.boutiklic.com', '/x')).not.toBe(cacheKey('b.boutiklic.com', '/x'))
  })

  it('une même boutique demandée deux fois ne fait qu\'un appel au core', async () => {
    const g = await startFakeGateway(() => ({ body: site('x') }))
    closers.push(g.close)
    const shared = config(g.url)

    await Promise.all([getStorefront(shared, 'a.boutiklic.com'), getStorefront(shared, 'a.boutiklic.com'), getStorefront(shared, 'a.boutiklic.com')])
    await getStorefront(shared, 'a.boutiklic.com')

    expect(g.requests).toHaveLength(1)
  })

  it("une boutique inconnue ou non publiée (404 du core) donne null, pas une erreur", async () => {
    const g = await startFakeGateway(() => ({ status: 404, body: { status: 404 } }))
    closers.push(g.close)
    expect(await getStorefront(config(g.url), 'inconnue.boutiklic.com')).toBeNull()
    expect(await getProduct(config(g.url), 'inconnue.boutiklic.com', 'x')).toBeNull()
  })

  it('une panne du core est une erreur avec son statut, et n\'est PAS mise en cache', async () => {
    let calls = 0
    const g = await startFakeGateway(() => ({ status: ++calls === 1 ? 503 : 200, body: calls === 1 ? { status: 503, detail: 'indisponible' } : site('revenue') }))
    closers.push(g.close)
    const shared = config(g.url)

    await expect(getStorefront(shared, 'b.boutiklic.com')).rejects.toBeInstanceOf(CoreError)
    await expect(getStorefront(shared, 'c.boutiklic.com')).resolves.toMatchObject({ name: 'revenue' })
    await expect(getStorefront(shared, 'b.boutiklic.com')).resolves.toMatchObject({ name: 'revenue' })
  })

  it("borne la page demandée et encode l'identifiant", async () => {
    const g = await startFakeGateway(() => ({ body: {} }))
    closers.push(g.close)
    await getProducts(config(g.url), 'b.boutiklic.com', -5, 24)
    await getProduct(config(g.url), 'b.boutiklic.com', '../x?y=1')
    expect(g.requests[0].url).toBe('/api/v1/public/products?page=0&size=24')
    expect(g.requests[1].url).toBe('/api/v1/public/products/..%2Fx%3Fy%3D1')
  })

  it("n'envoie aucun en-tête d'identité ni d'authentification", async () => {
    const g = await startFakeGateway(() => ({ body: {} }))
    closers.push(g.close)
    await getStorefront(config(g.url), 'b.boutiklic.com')
    for (const forbidden of ['authorization', 'cookie', 'x-tenant-id', 'x-client-ip']) expect(g.requests[0].headers[forbidden]).toBeUndefined()
  })

  it("l'URL d'une lecture ne contient plus rien de variable en dehors du chemin", () => {
    expect(readUrl({ gatewayUrl: 'http://gw:8080' }, '/public/products?page=1')).toBe('http://gw:8080/api/v1/public/products?page=1')
  })
})
