// react-test-renderer et react-native résolvent React à la RACINE du monorepo, alors que le code de l'app pourrait
// résoudre la copie du dossier mobile : deux copies de React → « Invalid hook call ». On les aligne sur celle du renderer.
jest.mock('react', () => jest.requireActual(require.resolve('react', { paths: [require('path').dirname(require.resolve('react-test-renderer'))] })))
// Le babel de l'app compile le JSX vers le runtime NativeWind, introuvable depuis les fichiers react-native de la racine.
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'), { virtual: true })
jest.mock('react-native-css-interop/jsx-dev-runtime', () => jest.requireActual('react/jsx-dev-runtime'), { virtual: true })
// lucide-react-native est publié en ESM (non transformé par jest) : les icônes ne sont pas l'objet de ce test.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (target: Record<string, unknown>, prop: string) => (prop in target ? target[prop] : () => null) }))
// i18n réel (textes fr de l'app) mais sans expo-localization, dont le module natif n'est pas chargeable sous jest ici.
jest.mock('../../i18n', () => {
  const { createInstance } = require('i18next')
  const { initReactI18next } = require('react-i18next')
  const i18n = createInstance()
  i18n.use(initReactI18next).init({ lng: 'fr', fallbackLng: 'fr', resources: { fr: { translation: require('../../i18n/locales/fr.json') } }, interpolation: { escapeValue: false } })
  return { __esModule: true, default: i18n }
})
jest.mock('../../lib/apiClient', () => {
  class NetworkError extends Error {
    constructor() {
      super('Connexion au serveur impossible')
      this.name = 'NetworkError'
    }
  }
  return { NetworkError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
jest.mock('../../lib/syncEngine', () => ({ syncEngine: { enqueue: jest.fn().mockResolvedValue(undefined) } }))
jest.mock('../../lib/inventoryApi', () => ({ inventoryApi: { adjust: jest.fn(), changeThreshold: jest.fn() } }))
jest.mock('../../lib/depotsApi', () => ({ depotsApi: { getAll: jest.fn().mockResolvedValue([]) } }))
jest.mock('../../lib/productsApi', () => ({
  productsApi: {
    update: jest.fn().mockResolvedValue({}),
    setFavorite: jest.fn(),
    deactivate: jest.fn(),
  },
}))
jest.mock('../../lib/fileApi', () => ({
  fileApi: { upload: jest.fn((f: { name: string }) => Promise.resolve({ url: `https://cdn.test/${f.name}`, fileName: f.name })) },
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://b.jpg', fileName: 'b.jpg', mimeType: 'image/jpeg' }],
  }),
}))
jest.mock('../../components/SelectField', () => ({ __esModule: true, default: () => null }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Product } from '../../types'
import { productsApi } from '../../lib/productsApi'
import { NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import { allText, flush } from '../../testing/renderHelpers'
import ProductDetail from './ProductDetail'

const updateProduct = productsApi.update as jest.Mock
const mounted: ReactTestRenderer[] = []

const baseProduct: Product = {
  id: 'p1',
  name: 'Riz local 25kg',
  category: 'Alimentation',
  categoryId: 'c1',
  purchasePrice: 80000,
  salePrice: 100000,
  currency: 'GNF',
  imageUrls: ['https://cdn.test/cover.jpg'],
  quantity: 10,
  alertThreshold: 2,
  lastRestockAt: null,
  isFavorite: false,
  isActive: true,
}

async function render(product: Product = baseProduct) {
  const onImagesChanged = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      <ProductDetail
        product={product}
        onBack={jest.fn()}
        formatCurrency={(n) => String(n)}
        onQuantityChanged={jest.fn()}
        onFavoriteChanged={jest.fn()}
        onThresholdChanged={jest.fn()}
        onImagesChanged={onImagesChanged}
        onDeleted={jest.fn()}
      />,
    )
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onImagesChanged }
}

beforeEach(() => {
  updateProduct.mockClear().mockResolvedValue({})
  ;(syncEngine.enqueue as jest.Mock).mockClear()
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

/** Couvre ImageCarousel via ProductDetail (cf. plan images multiples §3-5) : ajout/suppression
 *  directs sur une fiche existante, enregistrement immédiat (pas de bouton "Enregistrer"). */
describe('fiche produit (mobile) — carrousel d’images', () => {
  it('supprimer la couverture enregistre tout de suite et notifie le parent', async () => {
    const { renderer, onImagesChanged } = await render()
    const removeButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Supprimer cette image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => removeButton.props.onPress())

    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ imageUrls: [] }))
    expect(onImagesChanged).toHaveBeenCalledWith('p1', [])
  })

  it('ajouter une image l’upload et enregistre la nouvelle galerie', async () => {
    const { renderer, onImagesChanged } = await render()
    const addButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Ajouter une image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => addButton.props.onPress())
    await flush()

    expect(updateProduct).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({ imageUrls: ['https://cdn.test/cover.jpg', 'https://cdn.test/b.jpg'] }),
    )
    expect(onImagesChanged).toHaveBeenCalledWith('p1', ['https://cdn.test/cover.jpg', 'https://cdn.test/b.jpg'])
  })

  it('sans image : propose un bouton d’ajout au centre, jamais de suppression', async () => {
    const { renderer } = await render({ ...baseProduct, imageUrls: [] })
    expect(allText(renderer)).toContain('Ajouter une image')
    const removeButtons = renderer.root.findAll((n) => n.props.accessibilityLabel === 'Supprimer cette image')
    expect(removeButtons).toHaveLength(0)
  })

  it('coupure réseau : mis en file d’attente, la galerie locale est quand même mise à jour (écriture optimiste)', async () => {
    updateProduct.mockRejectedValueOnce(new NetworkError('Connexion au serveur impossible'))
    const { renderer, onImagesChanged } = await render()
    const removeButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Supprimer cette image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => removeButton.props.onPress())

    expect(onImagesChanged).toHaveBeenCalledWith('p1', [])
    expect(allText(renderer)).not.toContain('Connexion au serveur impossible')
  })
})

/** Étude prix décimaux, phase 2 : une mise à jour REMPLACE le conditionnement côté serveur. Ajouter ou retirer une
 *  photo renvoie tout l'article — sans le lot, le serveur repasserait l'article à l'unité et effacerait son coût exact. */
describe('fiche produit (mobile) — conditionnement d’achat', () => {
  const packProduct: Product = { ...baseProduct, purchasePrice: 333, packSize: 3, packPurchasePrice: 1000 }

  async function removeCover(renderer: ReactTestRenderer) {
    const removeButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Supprimer cette image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => removeButton.props.onPress())
  }

  it('retirer une image renvoie le lot existant : le conditionnement n’est pas effacé', async () => {
    const { renderer } = await render(packProduct)
    await removeCover(renderer)

    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ packSize: 3, packPurchasePrice: 1000 }))
  })

  it('un article à l’unité ne reçoit aucun champ de lot', async () => {
    const { renderer } = await render()
    await removeCover(renderer)

    const sent = JSON.parse(JSON.stringify(updateProduct.mock.calls[0][1]))
    expect(sent).not.toHaveProperty('packSize')
    expect(sent).not.toHaveProperty('packPurchasePrice')
  })

  it('affiche le coût unitaire exact d’un article en lot, pas son prix d’achat arrondi', async () => {
    const { renderer } = await render(packProduct)

    const text = allText(renderer)
    expect(text).toContain('333,33 GNF') // coût exact (1 000 / 3), pas « 333 »
    expect(text).toContain('1 lot(s) de 3')
  })
})

/** Une mise à jour d'article REMPLACE tout côté serveur, catégorie fiscale comprise : renvoyer l'article sans elle la remettait
 *  silencieusement sur « automatique » (taux par défaut de la boutique) à chaque ajout ou retrait de photo. */
describe('fiche produit (mobile) — catégorie fiscale', () => {
  const taxedProduct: Product = { ...baseProduct, taxCategoryId: 'cat-standard' }

  async function removeCover(renderer: ReactTestRenderer) {
    const removeButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Supprimer cette image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => removeButton.props.onPress())
  }

  it('retirer une image renvoie la catégorie fiscale de l’article : elle n’est pas remise sur « automatique »', async () => {
    const { renderer } = await render(taxedProduct)
    await removeCover(renderer)

    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ taxCategoryId: 'cat-standard' }))
  })

  it('hors ligne : la mise à jour mise en file renvoie elle aussi la catégorie fiscale', async () => {
    updateProduct.mockRejectedValueOnce(new NetworkError())
    const { renderer } = await render(taxedProduct)
    await removeCover(renderer)

    const enqueued = (syncEngine.enqueue as jest.Mock).mock.calls.find(([type]) => type === 'UPDATE_PRODUCT')
    expect(enqueued).toBeDefined()
    expect(JSON.parse(enqueued![1])).toMatchObject({ productId: 'p1', taxCategoryId: 'cat-standard' })
  })

  it('un article sans catégorie fiscale (« automatique ») n’en reçoit pas', async () => {
    const { renderer } = await render()
    await removeCover(renderer)

    const sent = JSON.parse(JSON.stringify(updateProduct.mock.calls[0][1]))
    expect(sent).not.toHaveProperty('taxCategoryId')
  })

  it('la catégorie fiscale et le lot sont renvoyés ensemble', async () => {
    const { renderer } = await render({ ...taxedProduct, purchasePrice: 333, packSize: 3, packPurchasePrice: 1000 })
    await removeCover(renderer)

    expect(updateProduct).toHaveBeenCalledWith('p1', expect.objectContaining({ taxCategoryId: 'cat-standard', packSize: 3, packPurchasePrice: 1000 }))
  })
})
