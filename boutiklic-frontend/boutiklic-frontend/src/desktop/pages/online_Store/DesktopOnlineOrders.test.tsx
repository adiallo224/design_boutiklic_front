// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, string | number>) => (options?.total !== undefined ? `${key}:${options.from}-${options.to}/${options.total}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../hooks/useTopBar', () => ({ useTopBar: vi.fn() }))
vi.mock('../../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { sellingPriceDecimals: 0, currency: 'GNF' } }) }))
const auth = { role: 'OWNER' }
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: auth.role, tenantId: 't1' } }) }))
const plan = { included: true, loaded: true }
vi.mock('../../../hooks/useEntitlements', () => ({ useEntitlements: () => ({ loaded: plan.loaded, error: false, has: () => plan.included, limit: () => null, refresh: vi.fn() }) }))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/onlineOrdersApi', () => ({ onlineOrdersApi: { list: vi.fn(), blocklist: vi.fn() } }))
vi.mock('./BlocklistModal', () => ({ default: (p: { open: boolean }) => (p.open ? <div>LISTE-NOIRE-OUVERTE</div> : null) }))

import { onlineOrdersApi, type OrderSummary } from '../../../lib/onlineOrdersApi'
import DesktopOnlineOrders from './DesktopOnlineOrders'

const api = onlineOrdersApi as unknown as Record<'list', ReturnType<typeof vi.fn>>

const row = (n: number, o: Partial<OrderSummary> = {}): OrderSummary => ({
  id: `o${n}`, orderNumber: `CMD-000${n}`, storefrontId: 's1', status: 'PLACED', paymentStatus: 'UNPAID', fulfillmentStatus: 'UNFULFILLED', stockStatus: 'RESERVED', total: 5000, currency: 'GNF',
  buyerName: `Acheteur ${n}`, buyerPhone: '+224620000000', deliveryMethod: 'DELIVERY', placedAt: '2026-10-20T10:00:00Z', ...o,
})
const page = (items: OrderSummary[], total = items.length) => ({ items, page: 0, size: 20, total })

function open() {
  return render(
    <MemoryRouter initialEntries={['/commandes-en-ligne']}>
      <Routes>
        <Route path="/commandes-en-ligne" element={<DesktopOnlineOrders />} />
        <Route path="/commandes-en-ligne/:id" element={<div>DETAIL</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  auth.role = 'OWNER'
  plan.included = true
  plan.loaded = true
  api.list.mockResolvedValue(page([row(1), row(2)]))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DesktopOnlineOrders', () => {
  it('charge la première page (0 côté serveur, 20 par page) et liste les commandes', async () => {
    open()

    expect(await screen.findByText('CMD-0001')).toBeTruthy()
    expect(screen.getByText('Acheteur 2')).toBeTruthy()
    expect(api.list).toHaveBeenCalledWith({ status: undefined, paymentStatus: undefined, page: 0, size: 20 })
  })

  it('un clic sur une ligne ouvre la commande', async () => {
    open()

    fireEvent.click(await screen.findByText('CMD-0002'))

    expect(await screen.findByText('DETAIL')).toBeTruthy()
  })

  it("filtrer par état relance la recherche depuis la première page, 'Tous' retire le filtre", async () => {
    open()
    await screen.findByText('CMD-0001')

    fireEvent.change(screen.getByLabelText('onlineOrders.filters.status'), { target: { value: 'CONFIRMED' } })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: 'CONFIRMED', paymentStatus: undefined, page: 0, size: 20 }))
    fireEvent.change(screen.getByLabelText('onlineOrders.filters.payment'), { target: { value: 'PAID' } })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: 'CONFIRMED', paymentStatus: 'PAID', page: 0, size: 20 }))
    fireEvent.change(screen.getByLabelText('onlineOrders.filters.status'), { target: { value: '' } })
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: undefined, paymentStatus: 'PAID', page: 0, size: 20 }))
  })

  it("changer de filtre depuis la page 2 revient à la page 1 (sinon une page vide)", async () => {
    api.list.mockResolvedValue(page([row(1)], 45))
    open()
    await screen.findByText('CMD-0001')
    fireEvent.click(screen.getByRole('button', { name: '2' }))
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })))

    fireEvent.change(screen.getByLabelText('onlineOrders.filters.status'), { target: { value: 'PLACED' } })

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith({ status: 'PLACED', paymentStatus: undefined, page: 0, size: 20 }))
  })

  it('la pagination affiche la plage et demande la page suivante au serveur', async () => {
    api.list.mockResolvedValue(page([row(1)], 45))
    open()

    expect(await screen.findByText('onlineOrders.showingRange:1-20/45')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '3' }))

    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })))
    expect(await screen.findByText('onlineOrders.showingRange:41-45/45')).toBeTruthy()
  })

  it("aucune commande: invitation, et message distinct quand c'est un filtre qui vide la liste", async () => {
    api.list.mockResolvedValue(page([]))
    open()
    expect(await screen.findByText('onlineOrders.empty')).toBeTruthy()

    fireEvent.change(screen.getByLabelText('onlineOrders.filters.status'), { target: { value: 'EXPIRED' } })
    expect(await screen.findByText('onlineOrders.emptyFiltered')).toBeTruthy()
  })

  it('une erreur de chargement est affichée', async () => {
    api.list.mockRejectedValue(new Error('Réseau indisponible'))
    open()

    expect(await screen.findByText(/Réseau indisponible/)).toBeTruthy()
  })

  it("le propriétaire et le vendeur ouvrent la liste noire, le superviseur ne la voit pas", async () => {
    open()
    fireEvent.click(await screen.findByRole('button', { name: 'onlineOrders.blocklist.open' }))
    expect(await screen.findByText('LISTE-NOIRE-OUVERTE')).toBeTruthy()
    cleanup()

    auth.role = 'SELLER'
    open()
    await screen.findByText('CMD-0001')
    expect(screen.getByRole('button', { name: 'onlineOrders.blocklist.open' })).toBeTruthy()
    cleanup()

    auth.role = 'SUPERVISOR'
    open()
    await screen.findByText('CMD-0001')
    expect(screen.queryByRole('button', { name: 'onlineOrders.blocklist.open' })).toBeNull()
  })

  it("une offre sans vente en ligne affiche le message et n'appelle pas le serveur", async () => {
    plan.included = false
    open()

    expect(await screen.findByText('onlineStore.notIncludedTitle')).toBeTruthy()
    expect(api.list).not.toHaveBeenCalled()
  })
})
