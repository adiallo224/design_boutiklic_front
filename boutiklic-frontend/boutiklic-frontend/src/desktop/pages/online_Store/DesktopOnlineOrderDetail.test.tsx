// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, string>) => (options?.reason ? `${key}:${options.reason}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../hooks/useTopBar', () => ({ useTopBar: vi.fn() }))
vi.mock('../../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { sellingPriceDecimals: 0, currency: 'GNF' } }) }))
const auth = { role: 'OWNER' }
vi.mock('../../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: auth.role, tenantId: 't1' } }) }))
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
vi.mock('../../../lib/onlineOrdersApi', () => ({
  ORDER_ERROR: { transition: 'ORDER_002', notFound: 'ORDER_008', forbidden: 'ORDER_403' },
  onlineOrdersApi: { get: vi.fn(), act: vi.fn(), blockBuyer: vi.fn() },
}))

import { ApiError } from '../../../lib/apiClient'
import { onlineOrdersApi, type OrderDetail } from '../../../lib/onlineOrdersApi'
import DesktopOnlineOrderDetail from './DesktopOnlineOrderDetail'

const api = onlineOrdersApi as unknown as Record<'get' | 'act' | 'blockBuyer', ReturnType<typeof vi.fn>>

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: 'o1', orderNumber: 'CMD-0001', storefrontId: 's1', status: 'PLACED', paymentStatus: 'UNPAID', fulfillmentStatus: 'UNFULFILLED', stockStatus: 'RESERVED', currency: 'GNF',
    subtotal: 3000, deliveryFee: 2000, taxTotal: 0, total: 5000, totalIsFinal: true, deliveryMethod: 'DELIVERY', deliveryZoneId: 'z1', pickupPointId: null, deliveryArea: 'Kaloum',
    deliveryAddressText: 'Rue 1', deliveryLandmark: 'Près du marché', paymentMethod: 'CASH_ON_DELIVERY', buyerName: 'Aïssatou', buyerPhone: '+224 620 12 34 56', buyerEmail: null,
    buyerNote: null, saleId: null, placedAt: '2026-10-20T10:00:00Z', confirmedAt: null, completedAt: null, cancelledAt: null, cancelReason: null, handedOverAt: null,
    lines: [{ productId: 'p1', productName: 'Riz 25 kg', imageUrl: null, unitPrice: 1500, quantity: 2, taxRatePercent: null, lineTotalHt: 3000, taxAmount: 0, lineTotal: 3000 }],
    history: [{ dimension: 'ORDER', from: null, to: 'PLACED', actor: 'system', reason: null, at: '2026-10-20T10:00:00Z' }], riskScore: 0, riskFlags: [], ...overrides,
  }
}

function open() {
  return render(
    <MemoryRouter initialEntries={['/commandes-en-ligne/o1']}>
      <Routes>
        <Route path="/commandes-en-ligne/:id" element={<DesktopOnlineOrderDetail />} />
        <Route path="/commandes-en-ligne" element={<div>LISTE-DES-COMMANDES</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement

beforeEach(() => {
  auth.role = 'OWNER'
  api.get.mockResolvedValue(order())
  api.act.mockImplementation(async (_id: string, action: string) => order({ status: action === 'confirm' ? 'CONFIRMED' : 'PLACED' }))
  api.blockBuyer.mockResolvedValue({ blocked: 1 })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('DesktopOnlineOrderDetail', () => {
  it("affiche la commande, l'acheteur, les lignes et le total", async () => {
    open()

    expect(await screen.findByText('CMD-0001')).toBeTruthy()
    expect(screen.getByText('Aïssatou')).toBeTruthy()
    expect(screen.getByText('Riz 25 kg')).toBeTruthy()
    expect(screen.getByText('Kaloum')).toBeTruthy()
    expect(screen.getByText('onlineOrders.lines.total')).toBeTruthy()
    expect(screen.queryByText('onlineOrders.delivery.feeToConfirm')).toBeNull()
  })

  it("le numéro de l'acheteur ouvre l'appel et WhatsApp (chiffres seuls, lien externe sûr)", async () => {
    open()
    await screen.findByText('CMD-0001')

    const call = screen.getByText('+224 620 12 34 56').closest('a')!
    expect(call.getAttribute('href')).toBe('tel:+224 620 12 34 56')
    const wa = screen.getByText('onlineOrders.buyer.whatsapp').closest('a')!
    expect(wa.getAttribute('href')).toBe('https://wa.me/224620123456')
    expect(wa.getAttribute('rel')).toContain('noopener')
  })

  it("des frais « à confirmer » sont signalés et le total est dit provisoire", async () => {
    api.get.mockResolvedValue(order({ deliveryFee: null, totalIsFinal: false, total: 3000 }))
    open()

    expect(await screen.findByText('onlineOrders.delivery.feeToConfirm')).toBeTruthy()
    expect(screen.getByText('onlineOrders.lines.totalProvisional')).toBeTruthy()
    expect(screen.getByText('onlineOrders.lines.toConfirm')).toBeTruthy()
  })

  it("une commande reçue propose « Confirmer » en avant, plus « Annuler » et « Marquer payée »", async () => {
    open()
    await screen.findByText('CMD-0001')

    expect(button('onlineOrders.actions.confirm')).toBeTruthy()
    expect(button('onlineOrders.actions.cancel')).toBeTruthy()
    expect(button('onlineOrders.actions.mark-paid')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onlineOrders.actions.ship' })).toBeNull()
  })

  it("« Confirmer » s'exécute sans fenêtre de confirmation et met l'écran à jour avec la réponse", async () => {
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.confirm'))

    await waitFor(() => expect(api.act).toHaveBeenCalledWith('o1', 'confirm', undefined))
    expect(await screen.findByText('onlineOrders.status.CONFIRMED')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onlineOrders.actions.confirm' })).toBeNull()
    expect(button('onlineOrders.actions.prepare')).toBeTruthy()
  })

  it("« Annuler » demande confirmation et transmet le motif saisi", async () => {
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.cancel'))
    expect(api.act).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('onlineOrders.modal.reason'), { target: { value: '  Client injoignable  ' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'onlineOrders.actions.cancel' }).at(-1)!)

    await waitFor(() => expect(api.act).toHaveBeenCalledWith('o1', 'cancel', 'Client injoignable'))
  })

  it("« Retour » dans la fenêtre n'exécute rien", async () => {
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.cancel'))
    fireEvent.click(button('onlineOrders.modal.back'))

    expect(api.act).not.toHaveBeenCalled()
    expect(screen.queryByText('onlineOrders.confirmText.cancel')).toBeNull()
  })

  it("clôturer une commande non payée prévient qu'elle devient une dette", async () => {
    api.get.mockResolvedValue(order({ status: 'CONFIRMED', fulfillmentStatus: 'DELIVERED', stockStatus: 'CONSUMED', paymentStatus: 'UNPAID' }))
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.complete'))

    expect(await screen.findByText('onlineOrders.confirmText.completeDebt')).toBeTruthy()
  })

  it("clôturer une commande payée ne parle pas de dette", async () => {
    api.get.mockResolvedValue(order({ status: 'CONFIRMED', fulfillmentStatus: 'DELIVERED', stockStatus: 'CONSUMED', paymentStatus: 'PAID' }))
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.complete'))

    expect(await screen.findByText('onlineOrders.confirmText.complete')).toBeTruthy()
    expect(screen.queryByText('onlineOrders.confirmText.completeDebt')).toBeNull()
  })

  it("une transition devenue impossible (409) recharge la commande et le dit, sans message d'erreur brut", async () => {
    api.act.mockRejectedValue(new ApiError('Transition interdite', 409, 'ORDER_002'))
    api.get.mockResolvedValueOnce(order()).mockResolvedValue(order({ status: 'CANCELLED', stockStatus: 'RELEASED' }))
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.confirm'))

    expect(await screen.findByText('onlineOrders.stale')).toBeTruthy()
    expect(await screen.findByText('onlineOrders.status.CANCELLED')).toBeTruthy()
    expect(screen.queryByText('Transition interdite')).toBeNull()
  })

  it("une autre erreur serveur s'affiche dans la fenêtre, qui reste ouverte pour réessayer", async () => {
    api.act.mockRejectedValue(new ApiError('Stock insuffisant', 409, 'STOCK_001'))
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.actions.cancel'))
    fireEvent.click(screen.getAllByRole('button', { name: 'onlineOrders.actions.cancel' }).at(-1)!)

    expect(await screen.findByText('Stock insuffisant')).toBeTruthy()
    expect(screen.getByText('onlineOrders.confirmText.cancel')).toBeTruthy()
  })

  it("un superviseur consulte sans aucune action ni blocage d'acheteur", async () => {
    auth.role = 'SUPERVISOR'
    open()
    await screen.findByText('CMD-0001')

    expect(screen.queryByRole('button', { name: /onlineOrders\.actions\./ })).toBeNull()
    expect(screen.queryByRole('button', { name: 'onlineOrders.buyer.block' })).toBeNull()
  })

  it("bloquer l'acheteur demande confirmation, puis l'indique", async () => {
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.buyer.block'))

    await waitFor(() => expect(api.blockBuyer).toHaveBeenCalledWith('o1'))
    expect(await screen.findByText('onlineOrders.blocked')).toBeTruthy()
  })

  it("refuser la confirmation du navigateur n'appelle pas le serveur", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()
    await screen.findByText('CMD-0001')

    fireEvent.click(button('onlineOrders.buyer.block'))

    expect(api.blockBuyer).not.toHaveBeenCalled()
  })

  it("un risque élevé ou moyen est signalé avec ses raisons, un risque nul ne dit rien", async () => {
    api.get.mockResolvedValue(order({ riskScore: 80, riskFlags: ['NEW_CUSTOMER', 'IP_BURST'] }))
    open()

    expect(await screen.findByText('onlineOrders.risk.high')).toBeTruthy()
    expect(screen.getByText('onlineOrders.risk.flags.NEW_CUSTOMER')).toBeTruthy()
    expect(screen.getByText('onlineOrders.risk.flags.IP_BURST')).toBeTruthy()
  })

  it("un conflit de stock est signalé en tête", async () => {
    api.get.mockResolvedValue(order({ status: 'CONFIRMED', stockStatus: 'CONFLICT' }))
    open()

    expect(await screen.findByText('onlineOrders.stockConflict')).toBeTruthy()
  })

  it("une commande introuvable affiche l'erreur au lieu d'un écran vide", async () => {
    api.get.mockRejectedValue(new ApiError('Commande introuvable', 404, 'ORDER_008'))
    open()

    expect(await screen.findByText('Commande introuvable')).toBeTruthy()
  })

  it("l'historique est affiché du plus récent au plus ancien", async () => {
    api.get.mockResolvedValue(order({
      history: [
        { dimension: 'ORDER', from: null, to: 'PLACED', actor: 'system', reason: null, at: '2026-10-20T10:00:00Z' },
        { dimension: 'ORDER', from: 'PLACED', to: 'CONFIRMED', actor: 'u1', reason: null, at: '2026-10-20T11:00:00Z' },
      ],
    }))
    open()
    await screen.findByText('CMD-0001')

    const items = screen.getAllByRole('listitem').filter((li) => li.textContent?.includes('onlineOrders.history.dimension.ORDER'))
    expect(items[0].textContent).toContain('onlineOrders.status.CONFIRMED')
    expect(items[1].textContent).toContain('onlineOrders.status.PLACED')
  })
})
