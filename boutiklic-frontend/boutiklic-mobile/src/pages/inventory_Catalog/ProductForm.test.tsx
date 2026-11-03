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
// Précision des prix de vente de la boutique, modifiable par test (le préfixe « mock » est autorisé dans une fabrique jest.mock).
let mockSellingPriceDecimals = 0
jest.mock('../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { id: 't1', name: 'Chez Fatou', phone: null, currency: 'GNF', sellingPriceDecimals: mockSellingPriceDecimals } }) }))
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
jest.mock('../../lib/categoriesApi', () => ({ categoriesApi: { getAll: jest.fn().mockResolvedValue([]) } }))
jest.mock('../../lib/productsApi', () => ({ productsApi: { create: jest.fn().mockResolvedValue({ id: 'p1' }) } }))
jest.mock('../../lib/fileApi', () => ({
  fileApi: { upload: jest.fn((f: { name: string }) => Promise.resolve({ url: `https://cdn.test/${f.name}`, fileName: f.name })) },
}))
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn().mockResolvedValue({ granted: true }),
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://a.jpg', fileName: 'a.jpg', mimeType: 'image/jpeg' }],
  }),
}))
jest.mock('../../components/SelectField', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/BarcodeScannerModal', () => ({ __esModule: true, default: () => null }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { productsApi } from '../../lib/productsApi'
import { fileApi } from '../../lib/fileApi'
import { allText, flush, press, pressable } from '../../testing/renderHelpers'
import ProductForm from './ProductForm'

const createProduct = productsApi.create as jest.Mock
const uploadFile = fileApi.upload as jest.Mock
const mounted: ReactTestRenderer[] = []

async function render(props: Partial<React.ComponentProps<typeof ProductForm>> = {}) {
  const onBack = jest.fn()
  const onCreated = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<ProductForm onBack={onBack} onCreated={onCreated} {...props} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onBack, onCreated }
}

beforeEach(() => {
  mockSellingPriceDecimals = 0
  createProduct.mockClear()
  uploadFile.mockClear()
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

/** Couvre ImageGalleryEditor via ProductForm (cf. plan images multiples §3-4) : la galerie n'a pas
 *  d'écran dédié en création, seule cette intégration exerce réellement le composant. */
describe('création d’article (mobile) — galerie d’images', () => {
  it('sans image : la création envoie une galerie vide', async () => {
    const { renderer, onCreated } = await render()
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs[0].props.onChangeText('Riz local'))
    await act(async () => inputs[1].props.onChangeText('12000'))
    await press(renderer, "Enregistrer l'article")
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: [] }))
    expect(onCreated).toHaveBeenCalledTimes(1)
  })

  it('ajouter une image l’upload tout de suite et l’inclut à la création', async () => {
    const { renderer } = await render()
    await press(renderer, 'Ajouter une image')
    await flush()
    expect(uploadFile).toHaveBeenCalledTimes(1)
    expect(allText(renderer)).toContain('Couverture')

    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs[0].props.onChangeText('Riz local'))
    await act(async () => inputs[1].props.onChangeText('12000'))
    await press(renderer, "Enregistrer l'article")
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: ['https://cdn.test/a.jpg'] }))
  })

  it('supprimer l’unique image retire le badge Couverture et revient à une galerie vide', async () => {
    const { renderer } = await render()
    await press(renderer, 'Ajouter une image')
    await flush()

    const removeButton = renderer.root.findAll(
      (n) => n.props.accessibilityLabel === 'Supprimer cette image' && typeof n.props.onPress === 'function',
    )[0]
    await act(async () => removeButton.props.onPress())

    expect(allText(renderer)).not.toContain('Couverture')
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs[0].props.onChangeText('Riz local'))
    await act(async () => inputs[1].props.onChangeText('12000'))
    await press(renderer, "Enregistrer l'article")
    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ imageUrls: [] }))
  })
})

/** Étude prix décimaux, phase 2 : un article acheté en lot (ex. paquet de 3 boîtes à 1 000). Le coût unitaire est
 *  affiché en direct (333,33) et le serveur dérive le prix d'achat du lot ; le client n'envoie que le lot. */
describe('création d’article (mobile) — achat par lot', () => {
  async function fill(renderer: ReactTestRenderer) {
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs[0].props.onChangeText('Sardines'))
    await act(async () => inputs[1].props.onChangeText('400'))
  }

  it('sans lot : aucun champ de lot n’est envoyé (comportement d’origine)', async () => {
    const { renderer } = await render()
    await fill(renderer)
    await press(renderer, "Enregistrer l'article")

    const sent = JSON.parse(JSON.stringify(createProduct.mock.calls[0][0]))
    expect(sent).not.toHaveProperty('packSize')
    expect(sent).not.toHaveProperty('packPurchasePrice')
  })

  it('en lot : le lot est envoyé, le prix d’achat est l’arrondi du coût unitaire', async () => {
    const { renderer } = await render()
    await fill(renderer)
    await press(renderer, 'Acheté par lot')
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs.find((i) => i.props.placeholder === '3')!.props.onChangeText('3'))
    await act(async () => inputs.find((i) => i.props.placeholder === '0' && i.props.value === '')!.props.onChangeText('1000'))

    await press(renderer, "Enregistrer l'article")

    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ packSize: 3, packPurchasePrice: 1000, purchasePrice: 333 }))
  })

  it('en lot : affiche le coût unitaire exact en direct', async () => {
    const { renderer } = await render()
    await fill(renderer)
    await press(renderer, 'Acheté par lot')
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs.find((i) => i.props.placeholder === '3')!.props.onChangeText('3'))
    await act(async () => inputs.find((i) => i.props.placeholder === '0' && i.props.value === '')!.props.onChangeText('1000'))

    expect(allText(renderer)).toContain('333,33 GNF')
  })

  it('en lot : le bouton « Enregistrer » reste désactivé tant que le lot est incomplet', async () => {
    const { renderer } = await render()
    await fill(renderer)
    expect(pressable(renderer, "Enregistrer l'article").props.disabled).toBe(false) // à l'unité, le nom et le prix suffisent

    await press(renderer, 'Acheté par lot')
    expect(pressable(renderer, "Enregistrer l'article").props.disabled).toBe(true) // lot vide

    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs.find((i) => i.props.placeholder === '3')!.props.onChangeText('3'))
    expect(pressable(renderer, "Enregistrer l'article").props.disabled).toBe(true) // unités saisies, prix du lot manquant

    await act(async () => renderer.root.findAllByType(TextInput).find((i) => i.props.placeholder === '0' && i.props.value === '')!.props.onChangeText('1000'))
    expect(pressable(renderer, "Enregistrer l'article").props.disabled).toBe(false) // lot complet
  })
})

/** Étude prix décimaux, phase 5bis : le prix de VENTE suit la précision réglée par la boutique (0 à 2 décimales, même en GNF) ;
 *  le prix d'achat, lui, reste un montant payé à la précision de la devise. */
describe('création d’article (mobile) — précision des prix de vente', () => {
  it('à 2 décimales : le prix de vente décimal est envoyé tel quel', async () => {
    mockSellingPriceDecimals = 2
    const { renderer } = await render()
    const inputs = renderer.root.findAllByType(TextInput)
    await act(async () => inputs[0].props.onChangeText('Sardines'))
    await act(async () => inputs[1].props.onChangeText('333,33'))
    await press(renderer, "Enregistrer l'article")

    expect(createProduct).toHaveBeenCalledWith(expect.objectContaining({ salePrice: 333.33 }))
  })

  it('à 2 décimales : clavier décimal pour le prix de vente, clavier d’entiers pour le prix d’achat', async () => {
    mockSellingPriceDecimals = 2
    const { renderer } = await render()
    const inputs = renderer.root.findAllByType(TextInput)

    expect(inputs[1].props.keyboardType).toBe('decimal-pad') // prix de vente
    expect(inputs[2].props.keyboardType).toBe('number-pad') // prix d'achat : suit la devise, pas le réglage de vente
  })

  it('à 0 décimale (le défaut) : clavier d’entiers et seuls les chiffres sont gardés, comme avant', async () => {
    const { renderer } = await render()
    await act(async () => renderer.root.findAllByType(TextInput)[1].props.onChangeText('abc400'))

    const saleInput = renderer.root.findAllByType(TextInput)[1]
    expect(saleInput.props.keyboardType).toBe('number-pad')
    expect(saleInput.props.value).toBe('400')
  })
})
