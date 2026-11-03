import { describe, expect, it } from 'vitest'
import { newKey, uuidV4 } from '../lib/idempotency'

const V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

describe('uuidV4', () => {
  it("utilise randomUUID quand le navigateur l'offre", () => {
    expect(uuidV4({ randomUUID: () => '11111111-1111-4111-8111-111111111111', getRandomValues: (a: unknown) => a } as unknown as Crypto)).toBe('11111111-1111-4111-8111-111111111111')
  })

  it("sans randomUUID (navigateur ancien, page hors HTTPS): getRandomValues donne un UUID v4 valable et unique", () => {
    const legacy = { getRandomValues: <T extends ArrayBufferView | null>(array: T): T => { crypto.getRandomValues(array as Uint8Array); return array } }
    const keys = new Set(Array.from({ length: 200 }, () => uuidV4(legacy as unknown as Crypto)))
    expect(keys.size).toBe(200)
    for (const key of keys) expect(key).toMatch(V4)
  })

  it("sans aucune API crypto: toujours un UUID v4 valable (jamais une exception)", () => {
    const keys = new Set(Array.from({ length: 200 }, () => uuidV4(undefined as unknown as Crypto)))
    for (const key of keys) expect(key).toMatch(V4)
    expect(keys.size).toBeGreaterThan(190)
  })

  it('newKey par défaut passe par uuidV4', () => expect(newKey()).toMatch(V4))
})
