// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: Record<string, unknown>) => (options ? `${key}|${JSON.stringify(options)}` : key), i18n: { language: 'fr' } }),
}))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/storefrontsApi', () => ({
  storefrontsApi: { listProducts: vi.fn(), publishProducts: vi.fn(), publishAllProducts: vi.fn(), unpublishProducts: vi.fn() },
}))
vi.mock('../../../lib/productsApi', () => ({ productsApi: { search: vi.fn(), getById: vi.fn(), changeDescription: vi.fn() } }))

import { productsApi, type ProductResponse } from '../../../lib/productsApi'
import { storefrontsApi, type StorefrontProductResponse } from '../../../lib/storefrontsApi'
import OnlineStoreProductsTab from './OnlineStoreProductsTab'

const sf = storefrontsApi as unknown as Record<'listProducts' | 'publishProducts' | 'publishAllProducts' | 'unpublishProducts', ReturnType<typeof vi.fn>>
const pr = productsApi as unknown as Record<'search' | 'getById' | 'changeDescription', ReturnType<typeof vi.fn>>

const row = (o: Partial<StorefrontProductResponse> = {}): StorefrontProductResponse => ({
  productId: 'p1', name: 'Riz 25 kg', imageUrl: null, catalogPrice: 1500, onlinePrice: null, compareAtPrice: null, effectivePrice: 1500, currency: 'GNF', position: 0, active: true, ...o,
})
const catalog = (o: Partial<ProductResponse> = {}) =>
  ({ id: 'c1', name: 'Huile 5 L', barcode: null, categoryId: null, purchasePrice: 700, salePrice: 900, margin: 0, currency: 'GNF', imageUrl: null, imageUrls: [], taxCategoryId: null,
    favorite: false, active: true, packSize: null, packPurchasePrice: null, unitCost: 700, description: null, ...o }) as unknown as ProductResponse

const onChanged = vi.fn()
const open = () => render(<OnlineStoreProductsTab siteId="s1" decimals={0} onChanged={onChanged} />)
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } })

beforeEach(() => {
  vi.clearAllMocks()
  sf.listProducts.mockResolvedValue([row()])
  pr.search.mockResolvedValue([])
  pr.getById.mockResolvedValue(catalog({ id: 'p1', description: 'Riz parfumé' }))
})
afterEach(cleanup)

describe('OnlineStoreProductsTab — liste', () => {
  it("montre le prix affiché, et l'écart avec le catalogue quand un prix en ligne est fixé", async () => {
    sf.listProducts.mockResolvedValue([
      row({ productId: 'a', name: 'Sans prix en ligne' }),
      row({ productId: 'b', name: 'Promo', onlinePrice: 1200, effectivePrice: 1200, compareAtPrice: 1800 }),
    ])
    open()

    await screen.findByText('Sans prix en ligne')
    const text = document.body.textContent ?? ''
    expect(text).toContain('onlineStore.products.sameAsCatalog')
    expect(text).toContain('onlineStore.products.catalogPrice')
    expect(screen.getAllByText(/1.800/).length).toBe(1)
  })

  it("signale un article désactivé: listé pour le commerçant mais invisible sur le site, et ne compte pas parmi les visibles", async () => {
    sf.listProducts.mockResolvedValue([row({ productId: 'a', name: 'Actif' }), row({ productId: 'b', name: 'Éteint', active: false })])
    open()

    await screen.findByText('Éteint')
    expect(screen.getByText('onlineStore.products.inactive')).toBeTruthy()
    expect(document.body.textContent).toContain('"visible":1,"total":2')
  })

  it("sans article publié, explique quoi faire", async () => {
    sf.listProducts.mockResolvedValue([])
    open()

    expect(await screen.findByText('onlineStore.products.empty')).toBeTruthy()
    expect(screen.getByText('onlineStore.products.emptyHint')).toBeTruthy()
  })

  it("une erreur de chargement est affichée", async () => {
    sf.listProducts.mockRejectedValue(new Error('Serveur indisponible'))
    open()

    expect((await screen.findByRole('alert')).textContent).toContain('Serveur indisponible')
  })
})

describe('OnlineStoreProductsTab — retirer et tout publier', () => {
  it("retirer un article demande confirmation, puis recharge et prévient le parent (la liste de contrôle du site change)", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    sf.unpublishProducts.mockResolvedValue({ removed: 1 })
    open()
    await screen.findByText('Riz 25 kg')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.products\.remove Riz 25 kg/ }))

    await waitFor(() => expect(sf.unpublishProducts).toHaveBeenCalledWith('s1', ['p1']))
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1))
    expect(sf.listProducts).toHaveBeenCalledTimes(2)
  })

  it("ne retire rien si l'on refuse", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    open()
    await screen.findByText('Riz 25 kg')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.products\.remove Riz 25 kg/ }))

    expect(sf.unpublishProducts).not.toHaveBeenCalled()
    expect(onChanged).not.toHaveBeenCalled()
  })

  it("« Tout publier » demande confirmation et annonce combien d'articles ont été ajoutés", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    sf.publishAllProducts.mockResolvedValue({ created: 12, updated: 0 })
    open()
    await screen.findByText('Riz 25 kg')

    fireEvent.click(screen.getByRole('button', { name: 'onlineStore.products.publishAll' }))

    await waitFor(() => expect(sf.publishAllProducts).toHaveBeenCalledWith('s1'))
    expect((await screen.findByRole('status')).textContent).toContain('"count":12')
    expect(onChanged).toHaveBeenCalled()
  })

  it("un refus du serveur est affiché sans rien changer", async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    sf.unpublishProducts.mockRejectedValue(new Error('Votre offre n\'inclut pas cette fonction'))
    open()
    await screen.findByText('Riz 25 kg')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.products\.remove Riz 25 kg/ }))

    expect((await screen.findByRole('alert')).textContent).toContain("n'inclut pas")
    expect(onChanged).not.toHaveBeenCalled()
  })
})

describe('AddProductsModal (depuis l\'onglet)', () => {
  async function openAdd() {
    open()
    await screen.findByText('Riz 25 kg')
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.products\.add$/ }))
    await screen.findByText('onlineStore.products.addTitle')
  }
  const publishSelected = () => screen.getByRole('button', { name: 'onlineStore.products.publishSelected' }) as HTMLButtonElement

  it("ne propose ni les articles désactivés ni ceux déjà publiés", async () => {
    pr.search.mockResolvedValue([catalog({ id: 'p1', name: 'Déjà publié' }), catalog({ id: 'c2', name: 'Éteint', active: false }), catalog({ id: 'c3', name: 'Huile 5 L' })])
    await openAdd()

    await screen.findByText('Huile 5 L')
    expect(screen.queryByText('Déjà publié')).toBeNull()
    expect(screen.queryByText('Éteint')).toBeNull()
  })

  it('publie la sélection sans prix (prix du catalogue), puis recharge', async () => {
    pr.search.mockResolvedValue([catalog({ id: 'c1', name: 'Huile 5 L' }), catalog({ id: 'c2', name: 'Sucre' })])
    sf.publishProducts.mockResolvedValue({ created: 2, updated: 0 })
    await openAdd()
    await screen.findByText('Huile 5 L')
    expect(publishSelected().disabled).toBe(true)

    fireEvent.click(screen.getByLabelText(/onlineStore\.products\.selectAllShown/))
    expect(publishSelected().disabled).toBe(false)
    fireEvent.click(publishSelected())

    await waitFor(() => expect(sf.publishProducts).toHaveBeenCalledWith('s1', [{ productId: 'c1' }, { productId: 'c2' }]))
    await waitFor(() => expect(onChanged).toHaveBeenCalled())
  })

  it("cherche dans le catalogue après une pause de frappe, en ignorant une réponse périmée", async () => {
    const answers: Array<() => void> = []
    pr.search.mockImplementation((params: { query?: string }) => new Promise((resolve) => answers.push(() => resolve([catalog({ id: params.query ?? 'tout', name: `Résultat ${params.query ?? 'tout'}` })]))))
    await openAdd()
    await waitFor(() => expect(pr.search).toHaveBeenCalledTimes(1))

    fireEvent.change(screen.getByLabelText('onlineStore.products.searchPlaceholder'), { target: { value: 'riz' } })
    await waitFor(() => expect(pr.search).toHaveBeenCalledTimes(2))
    answers[1]()
    await screen.findByText('Résultat riz')
    answers[0]()
    await new Promise((r) => setTimeout(r, 50))

    expect(screen.queryByText('Résultat tout')).toBeNull()
    expect(screen.getByText('Résultat riz')).toBeTruthy()
  })

  it("plus de 500 articles d'un coup: refusé avant l'envoi, avec le plafond du serveur", async () => {
    pr.search.mockResolvedValue(Array.from({ length: 501 }, (_, i) => catalog({ id: `c${i}`, name: `Article ${i}` })))
    await openAdd()
    await screen.findByText('Article 0')

    fireEvent.click(screen.getByLabelText(/onlineStore\.products\.selectAllShown/))

    expect(publishSelected().disabled).toBe(true)
    expect((await screen.findAllByRole('alert')).some((a) => a.textContent?.includes('onlineStore.products.tooMany'))).toBe(true)
  })

  it("un refus du serveur (prix invalide, offre) est affiché et la fenêtre reste ouverte", async () => {
    pr.search.mockResolvedValue([catalog({ id: 'c1', name: 'Huile 5 L' })])
    sf.publishProducts.mockRejectedValue(new Error('Article désactivé'))
    await openAdd()
    await screen.findByText('Huile 5 L')

    fireEvent.click(screen.getByLabelText(/onlineStore\.products\.selectAllShown/))
    fireEvent.click(publishSelected())

    expect((await screen.findAllByRole('alert')).some((a) => a.textContent?.includes('Article désactivé'))).toBe(true)
    expect(screen.getByText('onlineStore.products.addTitle')).toBeTruthy()
  })
})

describe('EditPublishedProductModal (depuis l\'onglet)', () => {
  const priceField = () => screen.getByLabelText(/onlineStore\.products\.onlinePrice/) as HTMLInputElement
  const compareField = () => screen.getByLabelText(/onlineStore\.products\.comparePrice/) as HTMLInputElement
  const descriptionField = () => screen.getByLabelText(/onlineStore\.products\.description/) as HTMLTextAreaElement
  const save = () => screen.getByRole('button', { name: 'onlineStore.delivery.save' }) as HTMLButtonElement

  async function openEdit(r: StorefrontProductResponse = row()) {
    sf.listProducts.mockResolvedValue([r])
    open()
    await screen.findByText(r.name)
    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.edit/ }))
    await waitFor(() => expect(descriptionField().value).toBe('Riz parfumé'))
  }

  it("vider le prix en ligne le remet au prix du catalogue (null, pas 0)", async () => {
    sf.publishProducts.mockResolvedValue({ created: 0, updated: 1 })
    await openEdit(row({ onlinePrice: 1200, effectivePrice: 1200 }))
    expect(priceField().value).toBe('1200')

    type(priceField(), '')
    fireEvent.click(save())

    await waitFor(() => expect(sf.publishProducts).toHaveBeenCalledWith('s1', [{ productId: 'p1', onlinePrice: null, compareAtPrice: null, position: 0 }]))
  })

  it("un prix barré qui n'est pas supérieur au prix affiché est refusé localement", async () => {
    await openEdit()

    type(priceField(), '1200')
    type(compareField(), '1200')
    expect(save().disabled).toBe(true)
    type(compareField(), '1800')
    expect(save().disabled).toBe(false)
  })

  it("le prix barré est comparé au prix du catalogue quand aucun prix en ligne n'est fixé", async () => {
    await openEdit()

    type(compareField(), '1500')
    expect(save().disabled).toBe(true)
    type(compareField(), '1501')
    expect(save().disabled).toBe(false)
  })

  it("la description n'est enregistrée que si elle a changé, après les prix", async () => {
    sf.publishProducts.mockResolvedValue({ created: 0, updated: 1 })
    pr.changeDescription.mockResolvedValue({})
    await openEdit()

    type(priceField(), '1400')
    fireEvent.click(save())
    await waitFor(() => expect(sf.publishProducts).toHaveBeenCalled())
    expect(pr.changeDescription).not.toHaveBeenCalled()

    cleanup()
    vi.clearAllMocks()
    sf.publishProducts.mockResolvedValue({ created: 0, updated: 1 })
    pr.getById.mockResolvedValue(catalog({ id: 'p1', description: 'Riz parfumé' }))
    await openEdit()
    type(descriptionField(), '  Nouveau texte  ')
    fireEvent.click(save())
    await waitFor(() => expect(pr.changeDescription).toHaveBeenCalledWith('p1', 'Nouveau texte'))
    expect(sf.publishProducts.mock.invocationCallOrder[0]).toBeLessThan(pr.changeDescription.mock.invocationCallOrder[0])
  })

  it("une description effacée est envoyée comme absente (null)", async () => {
    sf.publishProducts.mockResolvedValue({ created: 0, updated: 1 })
    pr.changeDescription.mockResolvedValue({})
    await openEdit()

    type(descriptionField(), '   ')
    fireEvent.click(save())

    await waitFor(() => expect(pr.changeDescription).toHaveBeenCalledWith('p1', null))
  })

  it("si les prix sont refusés, la description n'est pas touchée", async () => {
    sf.publishProducts.mockRejectedValue(new Error('Prix invalide : 0 décimale autorisée'))
    await openEdit()

    type(priceField(), '1400')
    type(descriptionField(), 'Autre texte')
    fireEvent.click(save())

    expect((await screen.findAllByRole('alert')).some((a) => a.textContent?.includes('Prix invalide'))).toBe(true)
    expect(pr.changeDescription).not.toHaveBeenCalled()
  })

  it("une description de plus de 2000 caractères est refusée avant l'envoi", async () => {
    await openEdit()

    type(descriptionField(), 'x'.repeat(2001))

    expect(save().disabled).toBe(true)
  })

  it("si la description n'a pas pu être lue, on ne l'écrase pas: le champ est bloqué", async () => {
    pr.getById.mockRejectedValue(new Error('hors ligne'))
    sf.listProducts.mockResolvedValue([row()])
    open()
    await screen.findByText('Riz 25 kg')

    fireEvent.click(screen.getByRole('button', { name: /onlineStore\.delivery\.edit/ }))

    await waitFor(() => expect(descriptionField().disabled).toBe(true))
  })
})
