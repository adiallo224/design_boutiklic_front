// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// La clé de traduction suffit à reconnaître un texte, sans charger l'i18n réel.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }))
vi.mock('../../hooks/useTopBar', () => ({ useTopBar: vi.fn() }))
vi.mock('../../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { phone: '+224620000000' } }) }))
vi.mock('../../../lib/apiClient', () => {
  class ApiError extends Error {
    status: number
    errorCode?: string
    constructor(message: string, status: number, errorCode?: string) {
      super(message)
      this.status = status
      this.errorCode = errorCode
    }
  }
  return { ApiError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
vi.mock('../../../lib/storefrontsApi', () => ({
  STOREFRONT_ERROR: { slugTaken: 'STOREFRONT_003', notIncluded: 'STOREFRONT_004' },
  storefrontsApi: { list: vi.fn(), create: vi.fn(), checkSlug: vi.fn() },
}))
const entitlementsState = { loaded: true, error: false, has: vi.fn(), limit: vi.fn(), refresh: vi.fn() }
vi.mock('../../../hooks/useEntitlements', () => ({ useEntitlements: () => entitlementsState }))
const navigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => ({ ...(await importOriginal<typeof import('react-router-dom')>()), useNavigate: () => navigate }))

import { storefrontsApi, type StorefrontResponse } from '../../../lib/storefrontsApi'
import { primaryHostname } from '../../../lib/storefrontDomain'
import DesktopOnlineStores from './DesktopOnlineStores'

const api = storefrontsApi as unknown as Record<'list' | 'create' | 'checkSlug', ReturnType<typeof vi.fn>>

function site(overrides: Partial<StorefrontResponse> = {}): StorefrontResponse {
  return {
    id: 's1', slug: 'chez-mamadou', name: 'Chez Mamadou', status: 'PUBLISHED', locale: 'fr', contactPhone: '+224620000000', contactWhatsapp: null, contactEmail: null,
    publishedAt: '2026-10-20T10:00:00Z', createdAt: '2026-10-01T10:00:00Z',
    domains: [{ hostname: 'chez-mamadou.boutiklic.com', kind: 'SUBDOMAIN', status: 'ACTIVE', primary: true }], publicationBlockers: [], ...overrides,
  }
}

function grant(features: string[], limit: number | null = null) {
  entitlementsState.has.mockImplementation((f: string) => features.includes(f))
  entitlementsState.limit.mockReturnValue(limit)
}

beforeEach(() => {
  vi.clearAllMocks()
  entitlementsState.loaded = true
  grant(['ONLINE_STORE', 'MULTI_STOREFRONT'])
  api.list.mockResolvedValue([site()])
})
afterEach(cleanup)

describe('DesktopOnlineStores', () => {
  it('liste les sites avec leur adresse publique et leur état', async () => {
    render(<DesktopOnlineStores />)

    await screen.findByText('Chez Mamadou')
    const link = screen.getByRole('link', { name: /chez-mamadou\.boutiklic\.com/ })
    expect(link.getAttribute('href')).toBe('https://chez-mamadou.boutiklic.com')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
    expect(screen.getByText('onlineStore.status.PUBLISHED')).toBeTruthy()
  })

  it("un clic sur une ligne ouvre le détail du site", async () => {
    render(<DesktopOnlineStores />)

    fireEvent.click(await screen.findByText('Chez Mamadou'))

    expect(navigate).toHaveBeenCalledWith('/boutique-en-ligne/s1')
  })

  it('sans site, invite à créer le premier', async () => {
    api.list.mockResolvedValue([])
    render(<DesktopOnlineStores />)

    expect(await screen.findByText('onlineStore.empty')).toBeTruthy()
    expect(screen.getByText('onlineStore.emptyHint')).toBeTruthy()
  })

  it("une offre sans vente en ligne affiche « non inclus » et n'appelle jamais l'API des sites", async () => {
    grant(['POS'])
    render(<DesktopOnlineStores />)

    expect(await screen.findByText('onlineStore.notIncludedTitle')).toBeTruthy()
    expect(screen.queryByText('onlineStore.newSite')).toBeNull()
    expect(api.list).not.toHaveBeenCalled()
  })

  it('attend la lecture des droits avant de conclure quoi que ce soit', () => {
    entitlementsState.loaded = false
    render(<DesktopOnlineStores />)

    expect(screen.queryByText('onlineStore.notIncludedTitle')).toBeNull()
    expect(api.list).not.toHaveBeenCalled()
  })

  it("une erreur de chargement est affichée", async () => {
    api.list.mockRejectedValue(new Error('Serveur indisponible'))
    render(<DesktopOnlineStores />)

    expect(await screen.findByText(/Serveur indisponible/)).toBeTruthy()
  })

  it("sans l'option plusieurs sites, un site existant désactive « Nouveau site » et explique pourquoi", async () => {
    grant(['ONLINE_STORE'])
    render(<DesktopOnlineStores />)

    await screen.findByText('Chez Mamadou')
    expect(screen.getByRole('button', { name: /onlineStore\.newSite/ })).toHaveProperty('disabled', true)
    expect(screen.getByRole('note').textContent).toContain('onlineStore.multiNotIncluded')
  })

  it("avec l'option, la limite chiffrée de l'offre désactive la création une fois atteinte", async () => {
    grant(['ONLINE_STORE', 'MULTI_STOREFRONT'], 1)
    render(<DesktopOnlineStores />)

    await screen.findByText('Chez Mamadou')
    expect(screen.getByRole('button', { name: /onlineStore\.newSite/ })).toHaveProperty('disabled', true)
    expect(screen.getByRole('note').textContent).toContain('onlineStore.limitReached')
  })

  it("un site archivé ne compte plus dans la limite", async () => {
    grant(['ONLINE_STORE'])
    api.list.mockResolvedValue([site({ status: 'ARCHIVED' })])
    render(<DesktopOnlineStores />)

    await screen.findByText('Chez Mamadou')
    expect(screen.getByRole('button', { name: /onlineStore\.newSite/ })).toHaveProperty('disabled', false)
  })

  it('ouvre la création', async () => {
    render(<DesktopOnlineStores />)

    await screen.findByText('Chez Mamadou')
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.newSite/ }))

    expect(await screen.findByText('onlineStore.create.title')).toBeTruthy()
    await waitFor(() => expect(screen.getByDisplayValue('+224620000000')).toBeTruthy())
  })
})

describe('primaryHostname', () => {
  it("préfère le domaine principal, ignore un domaine retiré, et renvoie null sans domaine", () => {
    expect(primaryHostname(site())).toBe('chez-mamadou.boutiklic.com')
    expect(primaryHostname(site({ domains: [{ hostname: 'a.com', kind: 'CUSTOM', status: 'REMOVED', primary: true }, { hostname: 'b.com', kind: 'CUSTOM', status: 'ACTIVE', primary: false }] }))).toBe('b.com')
    expect(primaryHostname(site({ domains: [] }))).toBeNull()
  })
})
