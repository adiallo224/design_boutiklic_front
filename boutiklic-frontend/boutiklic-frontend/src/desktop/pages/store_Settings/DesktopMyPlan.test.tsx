// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${Object.values(options).join('|')}` : key),
    i18n: { language: 'fr' },
  }),
}))
vi.mock('../../hooks/useTopBar', () => ({ useTopBar: vi.fn() }))
vi.mock('../../../hooks/useEntitlements', () => ({ resetEntitlementsCache: vi.fn() }))
vi.mock('../../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { subscription: 'GRATUIT' } }) }))
const auth = vi.hoisted(() => ({ role: 'OWNER' }))
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { role: auth.role } }) }))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
const api = vi.hoisted(() => ({ overview: vi.fn(), plans: vi.fn(), requestChange: vi.fn(), cancelRequest: vi.fn() }))
vi.mock('../../../lib/subscriptionApi', () => ({ subscriptionApi: api }))

import DesktopMyPlan from './DesktopMyPlan'

const plan = (code: string, name: string, features: string[], limits: Record<string, number> = {}) => ({ code, name, features, limits })
const BASE = ['POS', 'INVENTORY_MANAGEMENT', 'ADVANCED_REPORTING', 'DESKTOP_AUTOUPDATE']
const PLANS = [
  plan('FREE', 'Gratuit', BASE, { MAX_PRODUCTS: 100 }),
  plan('ONLINE', 'Online', [...BASE, 'ONLINE_STORE'], { MAX_PRODUCTS: 500, MAX_STOREFRONTS: 1, MAX_ORDERS_PER_MONTH: 200 }),
  plan('BUSINESS', 'Business', [...BASE, 'MULTI_WAREHOUSE', 'ONLINE_STORE', 'MULTI_STOREFRONT'], { MAX_STOREFRONTS: 5 }),
]
const overview = (o: Record<string, unknown> = {}) => ({
  planCode: 'FREE',
  planName: 'Gratuit',
  status: 'ACTIVE',
  periodEnd: null,
  entitlements: { features: BASE, limits: { MAX_PRODUCTS: 100 }, source: 'TABLES' },
  pending: null,
  recent: [],
  ...o,
})
const request = (o: Record<string, unknown> = {}) => ({
  id: 'r1', fromPlan: 'FREE', toPlan: 'ONLINE', message: null, status: 'PENDING', resolutionNote: null, createdAt: '2026-10-30T10:00:00Z', resolvedAt: null, ...o,
})

const open = async () => {
  render(<MemoryRouter><DesktopMyPlan /></MemoryRouter>)
  await screen.findByRole('article', { name: 'Online' })
}
const card = (name: string) => screen.getByRole('article', { name })

describe('DesktopMyPlan', () => {
  beforeEach(() => {
    Object.values(api).forEach((f) => f.mockReset())
    auth.role = 'OWNER'
    api.overview.mockResolvedValue(overview())
    api.plans.mockResolvedValue(PLANS)
  })
  afterEach(cleanup)

  it('montre l\'offre actuelle et la compare aux autres, sans bouton sur l\'offre actuelle', async () => {
    await open()
    expect(within(card('Gratuit')).getByText('mySubscription.current')).toBeTruthy()
    expect(within(card('Gratuit')).queryByRole('button')).toBeNull()
    expect(within(card('Online')).getByRole('button', { name: 'mySubscription.requestPlan' })).toBeTruthy()
    expect(screen.getAllByText('Gratuit').length).toBeGreaterThan(0)
  })

  it('une boutique sans offre (droits hérités) l\'indique', async () => {
    api.overview.mockResolvedValue(overview({ planCode: null, planName: null }))
    await open()
    expect(screen.getByText('mySubscription.legacyHint')).toBeTruthy()
  })

  it('un membre qui n\'est pas propriétaire voit les offres sans pouvoir en demander', async () => {
    auth.role = 'SELLER'
    await open()
    expect(screen.queryByRole('button', { name: 'mySubscription.requestPlan' })).toBeNull()
    expect(screen.getByText('mySubscription.ownerOnly')).toBeTruthy()
  })

  it('demander une offre plus large affiche ce que l\'on gagne, puis envoie le message', async () => {
    api.requestChange.mockResolvedValue(request())
    await open()
    fireEvent.click(within(card('Online')).getByRole('button', { name: 'mySubscription.requestPlan' }))

    expect(await screen.findByText('mySubscription.youGain')).toBeTruthy()
    expect(screen.queryByText('mySubscription.youLose')).toBeNull()
    fireEvent.change(screen.getByLabelText('mySubscription.messageLabel'), { target: { value: 'Je veux vendre en ligne' } })
    api.overview.mockResolvedValue(overview({ pending: request() }))
    fireEvent.click(screen.getByRole('button', { name: 'mySubscription.sendRequest' }))

    await waitFor(() => expect(api.requestChange).toHaveBeenCalledWith('ONLINE', 'Je veux vendre en ligne'))
    expect(await screen.findByText('mySubscription.requestSent')).toBeTruthy()
    expect(await screen.findByText('mySubscription.pendingTitle')).toBeTruthy()
    expect(within(card('Online')).getByRole('button', { name: 'mySubscription.requested' })).toBeTruthy()
  })

  it('un retour à une offre plus petite avertit de ce que l\'on perd avant d\'envoyer', async () => {
    api.overview.mockResolvedValue(overview({
      planCode: 'ONLINE', planName: 'Online',
      entitlements: { features: [...BASE, 'ONLINE_STORE'], limits: { MAX_PRODUCTS: 500, MAX_STOREFRONTS: 1, MAX_ORDERS_PER_MONTH: 200 }, source: 'TABLES' },
    }))
    await open()
    fireEvent.click(within(card('Gratuit')).getByRole('button', { name: 'mySubscription.requestPlan' }))

    const warning = await screen.findByRole('note')
    expect(within(warning).getByText('mySubscription.youLose')).toBeTruthy()
    expect(within(warning).getByText('mySubscription.features.ONLINE_STORE')).toBeTruthy()
    expect(within(warning).getByText('mySubscription.downgradeNote')).toBeTruthy()
  })

  it('le refus du serveur est affiché dans la fenêtre, qui reste ouverte', async () => {
    api.requestChange.mockRejectedValue(new Error('Offre non proposée'))
    await open()
    fireEvent.click(within(card('Online')).getByRole('button', { name: 'mySubscription.requestPlan' }))
    fireEvent.click(await screen.findByRole('button', { name: 'mySubscription.sendRequest' }))

    expect(await screen.findByText('Offre non proposée')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'mySubscription.sendRequest' })).toBeTruthy()
  })

  it('annule la demande en attente', async () => {
    api.overview.mockResolvedValue(overview({ pending: request() }))
    api.cancelRequest.mockResolvedValue(undefined)
    await open()
    api.overview.mockResolvedValue(overview())
    fireEvent.click(screen.getByRole('button', { name: 'mySubscription.cancelRequest' }))

    await waitFor(() => expect(api.cancelRequest).toHaveBeenCalledWith('r1'))
    expect(await screen.findByText('mySubscription.requestCancelled')).toBeTruthy()
    expect(screen.queryByText('mySubscription.pendingTitle')).toBeNull()
  })

  it('affiche l\'historique avec le mot de l\'administrateur', async () => {
    api.overview.mockResolvedValue(overview({ recent: [request({ status: 'REJECTED', resolutionNote: 'Paiement non reçu' })] }))
    await open()
    expect(screen.getByText('mySubscription.status.REJECTED')).toBeTruthy()
    expect(screen.getByText('Paiement non reçu')).toBeTruthy()
  })

  it('affiche une erreur si l\'offre ne peut pas être chargée', async () => {
    api.overview.mockRejectedValue(new Error('hors ligne'))
    render(<MemoryRouter><DesktopMyPlan /></MemoryRouter>)
    expect((await screen.findByRole('alert')).textContent).toContain('hors ligne')
  })
})
