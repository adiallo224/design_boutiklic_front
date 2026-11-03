import { afterEach, describe, expect, it } from 'vitest'
import { upstreamFetch } from '../lib/upstream'
import { startFakeGateway } from './fakeGateway'

const closers: (() => Promise<void>)[] = []
afterEach(async () => {
  await Promise.all(closers.splice(0).map((close) => close()))
})

describe('appel HTTP vers le gateway', () => {
  it("respecte l'en-tête Host demandé (contrairement à fetch)", async () => {
    const g = await startFakeGateway(() => ({ body: { ok: true } }))
    closers.push(g.close)

    const viaUpstream = await upstreamFetch(g.url + '/x', { headers: { host: 'ma-boutique.boutiklic.com' } })
    await fetch(g.url + '/y', { headers: { host: 'ma-boutique.boutiklic.com' } })

    expect(await viaUpstream.json()).toEqual({ ok: true })
    expect(g.requests[0].headers.host).toBe('ma-boutique.boutiklic.com')
    expect(g.requests[1].headers.host, "fetch écrase Host: c'est la raison d'être de upstreamFetch").not.toBe('ma-boutique.boutiklic.com')
  })

  it('envoie le corps et la longueur, et relaie statut, en-têtes et corps', async () => {
    const g = await startFakeGateway((seen) => ({ status: 201, body: { echo: seen.body }, headers: { 'x-test': 'oui' } }))
    closers.push(g.close)
    const body = new TextEncoder().encode('{"a":1}').buffer as ArrayBuffer

    const response = await upstreamFetch(g.url + '/p', { method: 'POST', headers: { 'content-type': 'application/json' }, body })

    expect(response.status).toBe(201)
    expect(response.headers.get('x-test')).toBe('oui')
    expect(await response.json()).toEqual({ echo: '{"a":1}' })
    expect(g.requests[0].headers['content-length']).toBe('7')
  })

  it('une connexion refusée est une erreur, un délai dépassé aussi', async () => {
    await expect(upstreamFetch('http://127.0.0.1:1/x')).rejects.toThrow()
    const g = await startFakeGateway(() => ({ body: {} }))
    closers.push(g.close)
    const slow = await startFakeGatewayThatNeverAnswers()
    closers.push(slow.close)
    await expect(upstreamFetch(slow.url + '/x', { timeoutMs: 100 })).rejects.toThrow(/délai/)
  })
})

async function startFakeGatewayThatNeverAnswers() {
  const { createServer } = await import('node:http')
  const server = createServer(() => {})
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const port = (server.address() as import('node:net').AddressInfo).port
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise<void>((resolve) => { server.closeAllConnections(); server.close(() => resolve()) }) }
}
