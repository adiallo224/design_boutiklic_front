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
jest.mock('../../components/OfflineBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/BarcodeScannerModal', () => ({ __esModule: true, default: () => null }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Product } from '../../types'
import { allText, flush, press, textOf } from '../../testing/renderHelpers'
import ProductList from './ProductList'

const product = (id: string, name: string): Product => ({
  id,
  name,
  category: 'Alimentation',
  categoryId: 'c1',
  purchasePrice: 700,
  salePrice: 1000,
  currency: 'GNF',
  imageUrls: [],
  quantity: 5,
  alertThreshold: 1,
  lastRestockAt: null,
  isFavorite: false,
  isActive: true,
})

const PRODUCTS = [product('p1', 'Savon'), product('p2', 'Café'), product('p3', 'Thé')]

const handlers = () => ({
  onSelectProduct: jest.fn(),
  onAdd: jest.fn(),
  onOpenCategories: jest.fn(),
  onOpenNewArrival: jest.fn(),
  onOpenArrivalsList: jest.fn(),
  onOpenPromotions: jest.fn(),
  onOpenResellers: jest.fn(),
  onOpenAlerts: jest.fn(),
  onOpenSuppliers: jest.fn(),
  onOpenStockTransfers: jest.fn(),
  onOpenInventoryExports: jest.fn(),
  onOpenStockCounts: jest.fn(),
  onOpenLabels: jest.fn(),
  onPrintLabels: jest.fn(),
})

const mounted: ReactTestRenderer[] = []
async function render(overrides: Partial<React.ComponentProps<typeof ProductList>> = {}) {
  const h = handlers()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      <ProductList products={PRODUCTS} isLoading={false} error={null} isOwner canPrintLabels {...h} {...overrides} />,
    )
  })
  mounted.push(renderer)
  await flush()
  return { renderer, h: { ...h, ...overrides } as ReturnType<typeof handlers> }
}

/** Élément d'une carte article (ProductCard) portant `prop` et affichant `name`. */
const card = (renderer: ReactTestRenderer, name: string, prop: 'onPress' | 'onLongPress') => {
  const found = renderer.root.findAll((n) => typeof n.props[prop] === 'function' && textOf(n).includes(name) && !textOf(n).includes('Savon' === name ? 'Café' : 'Savon'))
  if (found.length === 0) throw new Error(`Aucune carte « ${name} » avec ${prop}`)
  return found[found.length - 1]
}
const longPress = (renderer: ReactTestRenderer, name: string) =>
  act(async () => {
    card(renderer, name, 'onLongPress').props.onLongPress()
  })
const tap = (renderer: ReactTestRenderer, name: string) =>
  act(async () => {
    card(renderer, name, 'onPress').props.onPress(name)
  })

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('liste stock (mobile) — sélection multiple pour les étiquettes', () => {
  it('sans sélection : un appui ouvre la fiche article, et « Ajouter un article » est proposé au propriétaire', async () => {
    const { renderer, h } = await render()
    await tap(renderer, 'Café')
    expect(h.onSelectProduct).toHaveBeenCalledTimes(1)
    expect(allText(renderer)).not.toContain('sélectionné')
    expect(allText(renderer)).toContain('Ajouter')
  })

  it('appui long : entre en sélection, la barre affiche le nombre et remplace « Ajouter un article »', async () => {
    const { renderer } = await render()
    await longPress(renderer, 'Café')
    const text = allText(renderer)
    expect(text).toContain('1 article sélectionné')
    expect(text).toContain('Imprimer les étiquettes')
    expect(text).toContain('Désélectionner')
  })

  it('en sélection, un appui simple coche/décoche au lieu d’ouvrir la fiche', async () => {
    const { renderer, h } = await render()
    await longPress(renderer, 'Café')
    await tap(renderer, 'Savon')
    expect(allText(renderer)).toContain('2 articles sélectionnés')
    expect(h.onSelectProduct).not.toHaveBeenCalled()

    await tap(renderer, 'Savon') // décoche
    expect(allText(renderer)).toContain('1 article sélectionné')
  })

  it('« Imprimer les étiquettes » envoie les articles cochés (1 exemplaire chacun)', async () => {
    const { renderer, h } = await render()
    await longPress(renderer, 'Café')
    await tap(renderer, 'Savon')
    await press(renderer, 'Imprimer les étiquettes')
    expect(h.onPrintLabels).toHaveBeenCalledTimes(1)
    const items = h.onPrintLabels.mock.calls[0][0]
    expect(items).toHaveLength(2)
    expect(items).toEqual(expect.arrayContaining([{ productId: 'p1', copies: 1 }, { productId: 'p2', copies: 1 }]))
  })

  it('« Désélectionner » quitte la sélection et rend « Ajouter un article »', async () => {
    const { renderer } = await render()
    await longPress(renderer, 'Café')
    await press(renderer, 'Désélectionner')
    const text = allText(renderer)
    expect(text).not.toContain('sélectionné')
    expect(text).toContain('Ajouter')
  })

  it('un rôle qui ne peut pas imprimer : l’appui long ne fait rien', async () => {
    const { renderer } = await render({ canPrintLabels: false })
    const longPressable = renderer.root.findAll((n) => typeof n.props.onLongPress === 'function' && textOf(n).includes('Café'))
    expect(longPressable).toHaveLength(0)
  })
})
