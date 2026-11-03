// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/deliveryApi', () => ({
  MAX_ZONES: 50,
  MAX_PICKUP_POINTS: 20,
  deliveryApi: {
    listZones: vi.fn(), createZone: vi.fn(), updateZone: vi.fn(), deleteZone: vi.fn(),
    listPickupPoints: vi.fn(), createPickupPoint: vi.fn(), updatePickupPoint: vi.fn(), deletePickupPoint: vi.fn(),
  },
}))
vi.mock('../../../lib/depotsApi', () => ({ depotsApi: { getAll: vi.fn() } }))

import { deliveryApi, type DeliveryZoneResponse, type PickupPointResponse } from '../../../lib/deliveryApi'
import { depotsApi } from '../../../lib/depotsApi'
import OnlineStoreDeliveryTab from './OnlineStoreDeliveryTab'

const api = deliveryApi as unknown as Record<string, ReturnType<typeof vi.fn>>
const depots = depotsApi.getAll as unknown as ReturnType<typeof vi.fn>

const zone = (o: Partial<DeliveryZoneResponse> = {}): DeliveryZoneResponse => ({
  id: 'z1', name: 'Centre', areas: ['Kaloum', 'Almamya'], feeType: 'FLAT', fee: 2000, freeAbove: null, minOrder: null, etaText: 'Le jour même', active: true, position: 0,
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', ...o,
})
const point = (o: Partial<PickupPointResponse> = {}): PickupPointResponse => ({
  id: 'p1', depotId: null, name: 'Boutique centrale', addressText: 'Rue 1, Kaloum', latitude: null, longitude: null, hoursText: '8h-18h', active: true,
  createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-01T10:00:00Z', ...o,
})

const open = () => render(<OnlineStoreDeliveryTab siteId="s1" currency="GNF" decimals={0} />)
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  api.listZones.mockResolvedValue([zone()])
  api.listPickupPoints.mockResolvedValue([point()])
  depots.mockResolvedValue([])
})
afterEach(cleanup)

describe('OnlineStoreDeliveryTab — liste', () => {
  it('affiche les zones (lieux, frais, délai) et les points de retrait', async () => {
    open()

    await screen.findByText('Centre')
    expect(screen.getByText('Kaloum, Almamya')).toBeTruthy()
    expect(screen.getByText(/Le jour même/)).toBeTruthy()
    expect(screen.getByText('Boutique centrale')).toBeTruthy()
    expect(screen.getByText('Rue 1, Kaloum')).toBeTruthy()
    expect(screen.getByText('8h-18h')).toBeTruthy()
  })

  it('résume les trois types de frais, et la commande minimum', async () => {
    api.listZones.mockResolvedValue([
      zone({ id: 'a', name: 'Fixe', feeType: 'FLAT', fee: 2000 }),
      zone({ id: 'b', name: 'Gratuit', feeType: 'FLAT', fee: 0 }),
      zone({ id: 'c', name: 'Seuil', feeType: 'FREE_ABOVE', fee: 3000, freeAbove: 50000, minOrder: 10000 }),
      zone({ id: 'd', name: 'Téléphone', feeType: 'TO_CONFIRM', fee: null }),
    ])
    open()

    await screen.findByText('Fixe')
    const text = document.body.textContent ?? ''
    expect(text).toContain('onlineStore.delivery.free')
    expect(text).toContain('onlineStore.delivery.feeFreeAbove')
    expect(text).toContain('onlineStore.delivery.feeTypes.TO_CONFIRM')
    expect(text).toContain('onlineStore.delivery.minOrderShort')
  })

  it('tronque une longue liste de lieux', async () => {
    api.listZones.mockResolvedValue([zone({ areas: ['A', 'B', 'C', 'D', 'E'] })])
    open()

    expect(await screen.findByText('A, B, C +2')).toBeTruthy()
  })

  it("invite à créer une première zone et un premier point quand il n'y en a pas", async () => {
    api.listZones.mockResolvedValue([])
    api.listPickupPoints.mockResolvedValue([])
    open()

    expect(await screen.findByText('onlineStore.delivery.noZones')).toBeTruthy()
    expect(screen.getByText('onlineStore.delivery.noPickup')).toBeTruthy()
  })

  it("atteint le plafond de 50 zones: l'ajout est désactivé", async () => {
    api.listZones.mockResolvedValue(Array.from({ length: 50 }, (_, i) => zone({ id: `z${i}`, name: `Zone ${i}` })))
    open()

    await screen.findByText('Zone 0')
    expect((screen.getByRole('button', { name: /onlineStore\.delivery\.addZone/ }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /onlineStore\.delivery\.addPickup/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it("affiche l'erreur de chargement", async () => {
    api.listZones.mockRejectedValue(new Error('Serveur indisponible'))
    open()

    expect((await screen.findByRole('alert')).textContent).toContain('Serveur indisponible')
  })
})

describe('OnlineStoreDeliveryTab — suppression', () => {
  it("ne supprime rien si on refuse la confirmation", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()
    await screen.findByText('Centre')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.delete Centre/ }))

    expect(api.deleteZone).not.toHaveBeenCalled()
  })

  it('supprime une zone après confirmation puis recharge', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteZone.mockResolvedValue(undefined)
    open()
    await screen.findByText('Centre')
    api.listZones.mockResolvedValue([])

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.delete Centre/ }))

    await waitFor(() => expect(api.deleteZone).toHaveBeenCalledWith('s1', 'z1'))
    await screen.findByText('onlineStore.delivery.noZones')
  })

  it('supprime un point de retrait après confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.deletePickupPoint.mockResolvedValue(undefined)
    open()
    await screen.findByText('Boutique centrale')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.delete Boutique centrale/ }))

    await waitFor(() => expect(api.deletePickupPoint).toHaveBeenCalledWith('s1', 'p1'))
  })

  it("un échec de suppression est affiché et la liste reste", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.deleteZone.mockRejectedValue(new Error('Suppression impossible'))
    open()
    await screen.findByText('Centre')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.delete Centre/ }))

    expect((await screen.findByRole('alert')).textContent).toContain('Suppression impossible')
    expect(screen.getByText('Centre')).toBeTruthy()
  })
})

describe('DeliveryZoneModal (depuis l\'onglet)', () => {
  const nameField = () => screen.getByLabelText('onlineStore.delivery.zoneName') as HTMLInputElement
  const areasField = () => screen.getByLabelText(/onlineStore\.delivery\.areas/) as HTMLTextAreaElement
  const save = () => screen.getByRole('button', { name: 'onlineStore.delivery.save' }) as HTMLButtonElement

  async function openNewZone() {
    open()
    await screen.findByText('Centre')
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.addZone/ }))
    await screen.findByText('onlineStore.delivery.zoneNewTitle')
  }

  it('crée une zone à frais fixes avec ses lieux dédoublonnés', async () => {
    api.createZone.mockResolvedValue(zone())
    await openNewZone()
    expect(save().disabled).toBe(true)

    type(nameField(), 'Banlieue')
    type(areasField(), 'Matoto\nmatoto, Ratoma ; Hamdallayé')
    type(screen.getByLabelText(/onlineStore\.delivery\.fee \(GNF\)/), '3000')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())

    await waitFor(() => expect(api.createZone).toHaveBeenCalledTimes(1))
    expect(api.createZone).toHaveBeenCalledWith('s1', {
      name: 'Banlieue', areas: ['Matoto', 'Ratoma', 'Hamdallayé'], feeType: 'FLAT', fee: 3000, freeAbove: undefined, minOrder: undefined, etaText: undefined, active: true, position: 0,
    })
  })

  it("« gratuit au-delà d'un seuil » exige un seuil positif et envoie les deux montants", async () => {
    api.createZone.mockResolvedValue(zone())
    await openNewZone()
    type(nameField(), 'Centre 2')
    type(areasField(), 'Kaloum')
    fireEvent.click(screen.getByLabelText(/onlineStore\.delivery\.feeTypes\.FREE_ABOVE/))
    type(screen.getByLabelText(/onlineStore\.delivery\.fee \(GNF\)/), '2000')
    expect(save().disabled).toBe(true)

    type(screen.getByLabelText(/onlineStore\.delivery\.freeAbove \(GNF\)/), '50000')
    expect(save().disabled).toBe(false)
    fireEvent.click(save())

    await waitFor(() => expect(api.createZone).toHaveBeenCalled())
    expect(api.createZone.mock.calls[0][1]).toMatchObject({ feeType: 'FREE_ABOVE', fee: 2000, freeAbove: 50000 })
  })

  it("des frais « à confirmer » n'envoient aucun montant, même si on en avait saisi avant de changer d'avis", async () => {
    api.createZone.mockResolvedValue(zone())
    await openNewZone()
    type(nameField(), 'Lointain')
    type(areasField(), 'Coyah')
    type(screen.getByLabelText(/onlineStore\.delivery\.fee \(GNF\)/), '9999')

    fireEvent.click(screen.getByLabelText(/onlineStore\.delivery\.feeTypes\.TO_CONFIRM/))
    expect(screen.queryByLabelText(/onlineStore\.delivery\.fee \(GNF\)/)).toBeNull()
    fireEvent.click(save())

    await waitFor(() => expect(api.createZone).toHaveBeenCalled())
    expect(api.createZone.mock.calls[0][1]).toMatchObject({ feeType: 'TO_CONFIRM', fee: undefined, freeAbove: undefined })
  })

  it('un nom de lieu trop long ou une zone sans lieu ne peut pas être enregistrée', async () => {
    await openNewZone()
    type(nameField(), 'Zone')
    type(screen.getByLabelText(/onlineStore\.delivery\.fee \(GNF\)/), '1000')

    type(areasField(), '')
    expect(save().disabled).toBe(true)
    type(areasField(), 'x'.repeat(81))
    expect(save().disabled).toBe(true)
    expect(screen.getByText('onlineStore.delivery.areasProblems.tooLong')).toBeTruthy()
  })

  it('modifie une zone existante, préremplie', async () => {
    api.updateZone.mockResolvedValue(zone())
    open()
    await screen.findByText('Centre')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.edit Centre/ }))
    await screen.findByText('onlineStore.delivery.zoneEditTitle')
    expect(nameField().value).toBe('Centre')
    expect(areasField().value).toBe('Kaloum\nAlmamya')
    type(nameField(), 'Centre-ville')
    fireEvent.click(save())

    await waitFor(() => expect(api.updateZone).toHaveBeenCalledWith('s1', 'z1', expect.objectContaining({ name: 'Centre-ville', areas: ['Kaloum', 'Almamya'], fee: 2000 })))
    expect(api.createZone).not.toHaveBeenCalled()
  })

  it("un refus du serveur est affiché dans la fenêtre, qui reste ouverte", async () => {
    api.createZone.mockRejectedValue(new Error('Un site a au plus 50 zones'))
    await openNewZone()
    type(nameField(), 'Zone')
    type(areasField(), 'Kaloum')
    type(screen.getByLabelText(/onlineStore\.delivery\.fee \(GNF\)/), '1000')

    fireEvent.click(save())

    const alert = await within(document.body).findAllByRole('alert')
    expect(alert.some((a) => a.textContent?.includes('Un site a au plus 50 zones'))).toBe(true)
    expect(screen.getByText('onlineStore.delivery.zoneNewTitle')).toBeTruthy()
  })
})

describe('PickupPointModal (depuis l\'onglet)', () => {
  const save = () => screen.getByRole('button', { name: 'onlineStore.delivery.save' }) as HTMLButtonElement

  async function openNewPoint() {
    open()
    await screen.findByText('Boutique centrale')
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.addPickup/ }))
    await screen.findByText('onlineStore.delivery.pickupNewTitle')
  }

  it('crée un point avec nom et adresse seulement', async () => {
    api.createPickupPoint.mockResolvedValue(point())
    await openNewPoint()
    expect(save().disabled).toBe(true)

    type(screen.getByLabelText('onlineStore.delivery.pickupName'), 'Dépôt Nord')
    type(screen.getByLabelText('onlineStore.delivery.pickupAddress'), 'Route du Niger')
    fireEvent.click(save())

    await waitFor(() => expect(api.createPickupPoint).toHaveBeenCalledWith('s1', {
      depotId: undefined, name: 'Dépôt Nord', addressText: 'Route du Niger', latitude: undefined, longitude: undefined, hoursText: undefined, active: true,
    }))
  })

  it('un point GPS à moitié renseigné ou hors limites est refusé avant l\'envoi', async () => {
    await openNewPoint()
    type(screen.getByLabelText('onlineStore.delivery.pickupName'), 'Dépôt')
    type(screen.getByLabelText('onlineStore.delivery.pickupAddress'), 'Route')

    // Références gardées AVANT toute saisie: un message d'erreur s'affiche dans l'étiquette du champ et en change le nom accessible.
    const latitude = screen.getByLabelText('onlineStore.delivery.latitude')
    const longitude = screen.getByLabelText('onlineStore.delivery.longitude')
    type(latitude, '9.5')
    expect(save().disabled).toBe(true)
    type(longitude, '-13.7')
    expect(save().disabled).toBe(false)
    type(latitude, '91')
    expect(save().disabled).toBe(true)
    type(latitude, '9,509167')
    expect(save().disabled).toBe(false)
  })

  it('propose le choix du dépôt seulement quand la boutique en a plusieurs', async () => {
    depots.mockResolvedValue([{ id: 'd1', name: 'Principal', isDefault: true, active: true, createdAt: '' }])
    await openNewPoint()
    expect(screen.queryByText('onlineStore.delivery.pickupDepot')).toBeNull()

    cleanup()
    depots.mockResolvedValue([
      { id: 'd1', name: 'Principal', isDefault: true, active: true, createdAt: '' },
      { id: 'd2', name: 'Annexe', isDefault: false, active: true, createdAt: '' },
      { id: 'd3', name: 'Fermé', isDefault: false, active: false, createdAt: '' },
    ])
    await openNewPoint()
    const select = screen.getByLabelText(/onlineStore\.delivery\.pickupDepot/) as HTMLSelectElement
    expect([...select.options].map((o) => o.text)).toEqual(['onlineStore.delivery.pickupNoDepot', 'Principal', 'Annexe'])
  })

  it("modifie un point existant: les coordonnées sont reprises", async () => {
    api.listPickupPoints.mockResolvedValue([point({ latitude: 9.5, longitude: -13.7 })])
    api.updatePickupPoint.mockResolvedValue(point())
    open()
    await screen.findByText('Boutique centrale')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.edit Boutique centrale/ }))
    await screen.findByText('onlineStore.delivery.pickupEditTitle')
    expect((screen.getByLabelText('onlineStore.delivery.latitude') as HTMLInputElement).value).toBe('9.5')
    fireEvent.click(save())

    await waitFor(() => expect(api.updatePickupPoint).toHaveBeenCalledWith('s1', 'p1', expect.objectContaining({ latitude: 9.5, longitude: -13.7, name: 'Boutique centrale' })))
  })
})
