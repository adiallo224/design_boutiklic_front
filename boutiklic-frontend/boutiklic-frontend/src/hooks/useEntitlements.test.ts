// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../lib/entitlementsApi', () => ({ entitlementsApi: { get: vi.fn() } }))
vi.mock('../lib/session', () => ({ AUTH_CHANGED_EVENT: 'boutiklic_auth_changed', getActiveTenantId: vi.fn(() => 'tenant-1') }))

import { entitlementsApi } from '../lib/entitlementsApi'
import { getActiveTenantId } from '../lib/session'
import { resetEntitlementsCache, useEntitlements } from './useEntitlements'

const get = entitlementsApi.get as unknown as ReturnType<typeof vi.fn>
const tenant = getActiveTenantId as unknown as ReturnType<typeof vi.fn>

const PREMIUM = { features: ['POS', 'ONLINE_STORE'], limits: { MAX_STOREFRONTS: 2 }, source: 'SUBSCRIPTION' }

beforeEach(() => {
  resetEntitlementsCache()
  get.mockReset()
  tenant.mockReturnValue('tenant-1')
})
afterEach(cleanup)

describe('useEntitlements', () => {
  it('lit les droits de la boutique active, puis répond has() et limit()', async () => {
    get.mockResolvedValue(PREMIUM)
    const { result } = renderHook(() => useEntitlements())

    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.has('ONLINE_STORE')).toBe(true)
    expect(result.current.has('MULTI_STOREFRONT')).toBe(false)
    expect(result.current.limit('MAX_STOREFRONTS')).toBe(2)
    expect(result.current.limit('MAX_PRODUCTS')).toBeNull()
    expect(result.current.error).toBe(false)
  })

  it("plusieurs consommateurs (menu + écran) ne font qu'un seul appel réseau", async () => {
    get.mockResolvedValue(PREMIUM)
    const a = renderHook(() => useEntitlements())
    const b = renderHook(() => useEntitlements())
    await waitFor(() => expect(a.result.current.loaded && b.result.current.loaded).toBe(true))
    const c = renderHook(() => useEntitlements())

    expect(get).toHaveBeenCalledTimes(1)
    expect(c.result.current.loaded).toBe(true)
  })

  it("une lecture impossible n'accorde rien et n'empêche pas d'utiliser le reste de l'application", async () => {
    get.mockRejectedValue(new Error('hors ligne'))
    const { result } = renderHook(() => useEntitlements())

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.error).toBe(true)
    expect(result.current.has('ONLINE_STORE')).toBe(false)
  })

  it('un changement de boutique relit les droits de la nouvelle boutique (jamais ceux de la précédente)', async () => {
    get.mockResolvedValueOnce(PREMIUM).mockResolvedValueOnce({ features: ['POS'], limits: {}, source: 'LEGACY' })
    const { result } = renderHook(() => useEntitlements())
    await waitFor(() => expect(result.current.has('ONLINE_STORE')).toBe(true))

    tenant.mockReturnValue('tenant-2')
    act(() => {
      window.dispatchEvent(new Event('boutiklic_auth_changed'))
    })

    await waitFor(() => expect(get).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.has('ONLINE_STORE')).toBe(false)
  })

  it('refresh() force une nouvelle lecture (changement d\'offre)', async () => {
    get.mockResolvedValueOnce({ features: ['POS'], limits: {}, source: 'LEGACY' }).mockResolvedValueOnce(PREMIUM)
    const { result } = renderHook(() => useEntitlements())
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.has('ONLINE_STORE')).toBe(false)

    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.has('ONLINE_STORE')).toBe(true))
    expect(get).toHaveBeenCalledTimes(2)
  })
})
