import { describe, expect, it } from 'vitest'
import { TtlCache } from '../lib/ttlCache'

describe('TtlCache', () => {
  it('sert la valeur en cache jusqu\'à expiration, puis recharge', async () => {
    let now = 0
    let loads = 0
    const cache = new TtlCache<number>(1000, 10, () => now)
    const load = async () => ++loads

    expect(await cache.get('a|x', load)).toBe(1)
    now = 999
    expect(await cache.get('a|x', load)).toBe(1)
    now = 1000
    expect(await cache.get('a|x', load)).toBe(2)
  })

  it('regroupe les demandes identiques simultanées en un seul chargement', async () => {
    let loads = 0
    const cache = new TtlCache<number>(1000)
    const slow = async () => {
      loads++
      await new Promise((r) => setTimeout(r, 20))
      return 42
    }
    const results = await Promise.all([cache.get('k', slow), cache.get('k', slow), cache.get('k', slow)])
    expect(results).toEqual([42, 42, 42])
    expect(loads).toBe(1)
  })

  it("n'enregistre pas un échec, et la demande suivante réessaie", async () => {
    let calls = 0
    const cache = new TtlCache<string>(1000)
    await expect(cache.get('k', async () => { calls++; throw new Error('panne') })).rejects.toThrow('panne')
    await expect(cache.get('k', async () => { calls++; return 'ok' })).resolves.toBe('ok')
    expect(calls).toBe(2)
  })

  it('borne sa taille en évinçant les entrées périmées puis les plus anciennes', async () => {
    let now = 0
    const cache = new TtlCache<number>(100, 3, () => now)
    for (const k of ['a', 'b', 'c']) await cache.get(k, async () => 1)
    now = 50
    await cache.get('d', async () => 1)
    expect(cache.size).toBe(3)
    now = 200
    await cache.get('e', async () => 1)
    expect(cache.size).toBeLessThanOrEqual(3)
  })

  it('oublie une boutique sans toucher aux autres', async () => {
    const cache = new TtlCache<number>(1000)
    await cache.get('a.com|/x', async () => 1)
    await cache.get('b.com|/x', async () => 2)
    cache.invalidateHost('a.com')
    expect(await cache.get('a.com|/x', async () => 9)).toBe(9)
    expect(await cache.get('b.com|/x', async () => 9)).toBe(2)
  })
})
