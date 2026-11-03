// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, string>) => (options?.date ? `${key}:${options.date}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../hooks/useTopBar', () => ({ useTopBar: vi.fn() }))
vi.mock('../../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { sellingPriceDecimals: 0, currency: 'GNF' } }) }))
// Les onglets ont leurs propres tests: ici on vérifie seulement que la page les monte, avec les bonnes valeurs, et ce qu'elle fait de leurs notifications.
const productsTabProps = vi.fn()
vi.mock('./OnlineStoreProductsTab', () => ({
  default: (props: { siteId: string; decimals: number; onChanged: () => void }) => {
    productsTabProps(props)
    return <button type="button" onClick={props.onChanged}>PRODUITS-{props.siteId}-{props.decimals}</button>
  },
}))
vi.mock('./OnlineStoreDeliveryTab', () => ({ default: (props: { siteId: string; currency: string; decimals: number }) => <div>LIVRAISON-{props.siteId}-{props.currency}-{props.decimals}</div> }))
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
  storefrontsApi: { get: vi.fn(), update: vi.fn(), publish: vi.fn(), unpublish: vi.fn(), archive: vi.fn() },
}))

import { ApiError } from '../../../lib/apiClient'
import { storefrontsApi, type StorefrontResponse } from '../../../lib/storefrontsApi'
import DesktopOnlineStoreDetail, { parseTab } from './DesktopOnlineStoreDetail'

const api = storefrontsApi as unknown as Record<'get' | 'update' | 'publish' | 'unpublish' | 'archive', ReturnType<typeof vi.fn>>

function site(overrides: Partial<StorefrontResponse> = {}): StorefrontResponse {
  return {
    id: 's1', slug: 'chez-mamadou', name: 'Chez Mamadou', status: 'DRAFT', locale: 'fr', contactPhone: '+224620000000', contactWhatsapp: null, contactEmail: null,
    publishedAt: null, createdAt: '2026-10-01T10:00:00Z',
    domains: [{ hostname: 'chez-mamadou.boutiklic.com', kind: 'SUBDOMAIN', status: 'ACTIVE', primary: true }], publicationBlockers: [], ...overrides,
  }
}

function open(url = '/boutique-en-ligne/s1') {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/boutique-en-ligne/:id" element={<DesktopOnlineStoreDetail />} />
        <Route path="/boutique-en-ligne" element={<div>LISTE-DES-SITES</div>} />
      </Routes>
    </MemoryRouter>,
  )
}
const publishButton = () => screen.getByRole('button', { name: 'onlineStore.detail.publish' }) as HTMLButtonElement
const saveButton = () => screen.getByRole('button', { name: 'onlineStore.detail.save' }) as HTMLButtonElement

beforeEach(() => {
  vi.clearAllMocks()
  api.get.mockResolvedValue(site())
})
afterEach(cleanup)

describe('DesktopOnlineStoreDetail — publication', () => {
  it("un site sans contact ni article liste ce qui manque et ne peut pas être publié", async () => {
    api.get.mockResolvedValue(site({ contactPhone: null, publicationBlockers: ['CONTACT_REQUIRED', 'PRODUCT_REQUIRED'] }))
    open()

    await screen.findByText('onlineStore.detail.checklist')
    expect(screen.queryByText('onlineStore.detail.done.CONTACT_REQUIRED')).toBeNull()
    expect(screen.getByText('onlineStore.detail.blockers.CONTACT_REQUIRED')).toBeTruthy()
    expect(screen.getByText('onlineStore.detail.blockers.PRODUCT_REQUIRED')).toBeTruthy()
    expect(publishButton().disabled).toBe(true)
    expect(screen.queryByText('onlineStore.detail.ready')).toBeNull()
  })

  it("une fois tout prêt, la publication est possible et l'écran reflète la réponse du serveur", async () => {
    api.publish.mockResolvedValue(site({ status: 'PUBLISHED', publishedAt: '2026-10-25T10:00:00Z' }))
    open()
    await screen.findByText('onlineStore.detail.ready')

    fireEvent.click(publishButton())

    await screen.findByRole('button', { name: 'onlineStore.detail.unpublish' })
    expect(api.publish).toHaveBeenCalledWith('s1')
    expect(screen.queryByText('onlineStore.detail.checklist')).toBeNull()
    expect(screen.getByText('onlineStore.status.PUBLISHED')).toBeTruthy()
  })

  it("retirer un site de la vente le remet en brouillon", async () => {
    api.get.mockResolvedValue(site({ status: 'PUBLISHED', publishedAt: '2026-10-25T10:00:00Z' }))
    api.unpublish.mockResolvedValue(site({ status: 'DRAFT' }))
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'onlineStore.detail.unpublish' }))

    await screen.findByRole('button', { name: 'onlineStore.detail.publish' })
    expect(api.unpublish).toHaveBeenCalledWith('s1')
  })

  it("le serveur a le dernier mot: un refus (offre sans vente en ligne) est affiché et l'état reste inchangé", async () => {
    api.publish.mockRejectedValue(new ApiError('Votre offre...', 402, 'STOREFRONT_004'))
    open()
    await screen.findByText('onlineStore.detail.ready')

    fireEvent.click(publishButton())

    expect((await screen.findByRole('alert')).textContent).toContain('onlineStore.errors.notIncluded')
    expect(screen.getByText('onlineStore.status.DRAFT')).toBeTruthy()
  })

  it("un site suspendu ne peut être ni publié ni retiré par son propriétaire", async () => {
    api.get.mockResolvedValue(site({ status: 'SUSPENDED' }))
    open()

    await screen.findByText('onlineStore.detail.suspendedNotice')
    expect(screen.queryByRole('button', { name: 'onlineStore.detail.publish' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'onlineStore.detail.unpublish' })).toBeNull()
  })

  it("un site archivé est en lecture seule", async () => {
    api.get.mockResolvedValue(site({ status: 'ARCHIVED' }))
    open()

    await screen.findByText('onlineStore.status.ARCHIVED')
    expect(screen.queryByRole('button', { name: 'onlineStore.detail.save' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'onlineStore.detail.archive' })).toBeNull()
    expect((screen.getByLabelText('onlineStore.create.name') as HTMLInputElement).disabled).toBe(true)
  })
})

describe('DesktopOnlineStoreDetail — liste de contrôle', () => {
  it("un point rempli le dit (« fait »), il ne répète pas l'instruction à côté d'une coche", async () => {
    api.get.mockResolvedValue(site({ publicationBlockers: ['PRODUCT_REQUIRED'] }))
    open()

    await screen.findByText('onlineStore.detail.checklist')
    expect(screen.getByText('onlineStore.detail.done.CONTACT_REQUIRED')).toBeTruthy()
    expect(screen.queryByText('onlineStore.detail.blockers.CONTACT_REQUIRED')).toBeNull()
    expect(screen.getByText('onlineStore.detail.blockers.PRODUCT_REQUIRED')).toBeTruthy()
    expect(screen.queryByText('onlineStore.detail.done.PRODUCT_REQUIRED')).toBeNull()
  })

  it("tout rempli: les deux points sont « faits », plus aucune instruction", async () => {
    open()

    await screen.findByText('onlineStore.detail.ready')
    expect(screen.getByText('onlineStore.detail.done.CONTACT_REQUIRED')).toBeTruthy()
    expect(screen.getByText('onlineStore.detail.done.PRODUCT_REQUIRED')).toBeTruthy()
    expect(screen.queryByText(/onlineStore\.detail\.blockers\./)).toBeNull()
  })
})

describe('DesktopOnlineStoreDetail — informations', () => {
  it("l'adresse est affichée en lecture seule et son lien s'ouvre dans un nouvel onglet sans fuite de référent", async () => {
    open()

    await screen.findByText('onlineStore.detail.slugFixed')
    expect(screen.getByText('chez-mamadou')).toBeTruthy()
    const link = screen.getByRole('link', { name: /chez-mamadou\.boutiklic\.com/ })
    expect(link.getAttribute('href')).toBe('https://chez-mamadou.boutiklic.com')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it("« Enregistrer » n'est actif que si quelque chose a changé, et n'envoie que des champs utiles", async () => {
    api.update.mockImplementation(async (_id: string, body: { name: string }) => site({ name: body.name, contactPhone: '+224620000000' }))
    open()
    await screen.findByText('onlineStore.detail.info')
    expect(saveButton().disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('onlineStore.create.name'), { target: { value: ' Chez Mamadou & Fils ' } })
    expect(saveButton().disabled).toBe(false)
    fireEvent.click(saveButton())

    await waitFor(() => expect(api.update).toHaveBeenCalledWith('s1', { name: 'Chez Mamadou & Fils', locale: 'fr', contactPhone: '+224620000000', contactWhatsapp: undefined, contactEmail: undefined }))
    await screen.findByText('onlineStore.detail.saved')
    expect(saveButton().disabled).toBe(true)
  })

  it("un nom vide ne peut pas être enregistré", async () => {
    open()
    await screen.findByText('onlineStore.detail.info')

    fireEvent.change(screen.getByLabelText('onlineStore.create.name'), { target: { value: '   ' } })

    expect(saveButton().disabled).toBe(true)
  })

  it("effacer un contact l'enlève (champ vide = absent), ce qui rend de nouveau la publication impossible côté serveur", async () => {
    api.update.mockResolvedValue(site({ contactPhone: null, publicationBlockers: ['CONTACT_REQUIRED'] }))
    open()
    await screen.findByText('onlineStore.detail.info')

    fireEvent.change(screen.getByLabelText('onlineStore.create.phone'), { target: { value: '' } })
    fireEvent.click(saveButton())

    await screen.findByText('onlineStore.detail.blockers.CONTACT_REQUIRED')
    expect(api.update.mock.calls[0][1].contactPhone).toBeUndefined()
    expect(publishButton().disabled).toBe(true)
  })
})

describe('DesktopOnlineStoreDetail — archivage', () => {
  it("demande confirmation, et n'archive rien si on refuse", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'onlineStore.detail.archive' }))

    expect(api.archive).not.toHaveBeenCalled()
    expect(screen.queryByText('LISTE-DES-SITES')).toBeNull()
  })

  it("archive après confirmation puis revient à la liste", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.archive.mockResolvedValue(undefined)
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'onlineStore.detail.archive' }))

    await screen.findByText('LISTE-DES-SITES')
    expect(api.archive).toHaveBeenCalledWith('s1')
  })

  it("un échec d'archivage reste sur la page avec son message", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    api.archive.mockRejectedValue(new Error('Archivage impossible'))
    open()

    fireEvent.click(await screen.findByRole('button', { name: 'onlineStore.detail.archive' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Archivage impossible')
    expect(screen.queryByText('LISTE-DES-SITES')).toBeNull()
  })
})

describe('DesktopOnlineStoreDetail — chargement', () => {
  it("un site introuvable (ou d'une autre boutique) affiche l'erreur et un retour", async () => {
    api.get.mockRejectedValue(new Error('Site introuvable'))
    open()

    expect((await screen.findByRole('alert')).textContent).toContain('Site introuvable')
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.detail\.back/ }))
    await screen.findByText('LISTE-DES-SITES')
  })
})

describe('DesktopOnlineStoreDetail — onglets', () => {
  it("s'ouvre sur « Informations », et le contenu des autres onglets n'est pas monté", async () => {
    open()

    await screen.findByText('onlineStore.detail.info')
    expect(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.info' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText(/PRODUITS-/)).toBeNull()
    expect(screen.queryByText(/LIVRAISON-/)).toBeNull()
  })

  it("monte l'onglet demandé avec le site, la devise et la précision des prix de la boutique", async () => {
    open('/boutique-en-ligne/s1?tab=delivery')

    expect(await screen.findByText('LIVRAISON-s1-GNF-0')).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.delivery' }).getAttribute('aria-selected')).toBe('true')
    expect(screen.queryByText('onlineStore.detail.info')).toBeNull()
  })

  it("un clic sur un onglet l'affiche, et « Informations » ramène au formulaire", async () => {
    open()
    await screen.findByText('onlineStore.detail.info')

    fireEvent.click(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.products' }))
    expect(await screen.findByText('PRODUITS-s1-0')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.info' }))

    expect(await screen.findByText('onlineStore.detail.info')).toBeTruthy()
    expect(screen.queryByText(/PRODUITS-/)).toBeNull()
  })

  it("un onglet inconnu dans l'adresse retombe sur « Informations »", async () => {
    open('/boutique-en-ligne/s1?tab=n-importe-quoi')

    expect(await screen.findByText('onlineStore.detail.info')).toBeTruthy()
    expect(parseTab('products')).toBe('products')
    expect(parseTab(null)).toBe('info')
    expect(parseTab('')).toBe('info')
    expect(parseTab('<script>')).toBe('info')
  })

  it("la liste de contrôle propose d'aller corriger chaque point bloquant dans le bon onglet", async () => {
    api.get.mockResolvedValue(site({ contactPhone: null, publicationBlockers: ['CONTACT_REQUIRED', 'PRODUCT_REQUIRED'] }))
    open('/boutique-en-ligne/s1?tab=delivery')
    await screen.findByText('onlineStore.detail.checklist')

    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.fix.products' }))

    expect(await screen.findByText('PRODUITS-s1-0')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'onlineStore.detail.fix.products' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.detail.fix.info' }))
    expect(await screen.findByText('onlineStore.detail.info')).toBeTruthy()
  })

  it("publier un article relit la liste de contrôle, SANS écraser ce que l'on est en train de saisir", async () => {
    api.get.mockResolvedValueOnce(site({ publicationBlockers: ['PRODUCT_REQUIRED'] })).mockResolvedValue(site({ publicationBlockers: [] }))
    open()
    await screen.findByText('onlineStore.detail.blockers.PRODUCT_REQUIRED')
    fireEvent.change(screen.getByLabelText('onlineStore.create.name'), { target: { value: 'Nom en cours de saisie' } })

    fireEvent.click(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.products' }))
    fireEvent.click(await screen.findByText('PRODUITS-s1-0'))
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    fireEvent.click(screen.getByRole('tab', { name: 'onlineStore.detail.tabs.info' }))

    await screen.findByText('onlineStore.detail.ready')
    expect((screen.getByLabelText('onlineStore.create.name') as HTMLInputElement).value).toBe('Nom en cours de saisie')
    expect(publishButton().disabled).toBe(false)
  })

  it("un site archivé n'a ni onglets Articles/Livraison ni contenu de ces onglets, même demandé dans l'adresse", async () => {
    api.get.mockResolvedValue(site({ status: 'ARCHIVED' }))
    open('/boutique-en-ligne/s1?tab=products')

    await screen.findByText('onlineStore.status.ARCHIVED')
    expect(screen.queryByRole('tablist')).toBeNull()
    expect(screen.queryByText(/PRODUITS-/)).toBeNull()
  })
})
