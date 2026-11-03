// react-test-renderer et react-native résolvent React à la RACINE du monorepo, alors que le code de l'app pourrait
// résoudre la copie du dossier mobile : deux copies de React → « Invalid hook call ». On les aligne sur celle du renderer.
jest.mock('react', () => jest.requireActual(require.resolve('react', { paths: [require('path').dirname(require.resolve('react-test-renderer'))] })))

// Le babel de l'app compile le JSX vers le runtime NativeWind (react-native-css-interop), installé dans le dossier mobile mais
// introuvable depuis les fichiers react-native de la racine : on le remplace par le runtime JSX standard (className reste une simple prop).
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'), { virtual: true })
jest.mock('react-native-css-interop/jsx-dev-runtime', () => jest.requireActual('react/jsx-dev-runtime'), { virtual: true })

import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { allText, flush, press } from '../../testing/renderHelpers'
import type { Product } from '../../types'
import Labels from './Labels'

// --- Dépendances simulées : rôle, boutique, API, impression natif ; le store de réglages et le moteur d'étiquettes sont RÉELS. ---
let mockRole = 'OWNER'
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
// apiClient charge expo-device (module natif) : on n'en garde que ce que l'écran utilise.
jest.mock('../../lib/apiClient', () => {
  class NetworkError extends Error {
    constructor() {
      super('Connexion au serveur impossible')
      this.name = 'NetworkError'
    }
  }
  return { NetworkError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: mockRole, tenantId: 't1' } }) }))
jest.mock('../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { id: 't1', name: 'Chez Fatou' } }) }))
jest.mock('../../components/OfflineBanner', () => ({ __esModule: true, default: () => null }))
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
jest.mock('expo-crypto', () => ({ randomUUID: () => 'uuid-fixed' }))
jest.mock('../../lib/promotionsApi', () => ({ promotionsApi: { getAll: jest.fn().mockResolvedValue([]) } }))
jest.mock('../../lib/productsApi', () => ({ productsApi: { assignInternalBarcode: jest.fn() } }))
jest.mock('../../lib/printLabels', () => ({ printLabelsDocument: jest.fn().mockResolvedValue(undefined) }))

import { NetworkError } from '../../lib/apiClient'
import { promotionsApi } from '../../lib/promotionsApi'
import { printLabelsDocument } from '../../lib/printLabels'
import { productsApi } from '../../lib/productsApi'

const assignInternalBarcode = productsApi.assignInternalBarcode as jest.Mock
const print = printLabelsDocument as jest.Mock
const getPromotions = promotionsApi.getAll as jest.Mock

const product = (overrides: Partial<Product> & Pick<Product, 'id' | 'name'>): Product => ({
  category: 'Alimentation',
  categoryId: 'c1',
  purchasePrice: 700,
  salePrice: 1000,
  currency: 'GNF',
  quantity: 5,
  alertThreshold: 1,
  lastRestockAt: null,
  isFavorite: false,
  isActive: true,
  ...overrides,
})

const PRODUCTS: Product[] = [
  product({ id: 'p1', name: 'Savon de Marseille', barcode: '4006381333931', salePrice: 12500 }),
  product({ id: 'p2', name: 'Café moulu', salePrice: 500 }), // sans code-barres
  product({ id: 'p3', name: 'Thé vert', barcode: '5901234123457', salePrice: 3000 }),
]

const mounted: ReactTestRenderer[] = []

async function render(props: Partial<React.ComponentProps<typeof Labels>> = {}) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<Labels onBack={jest.fn()} products={PRODUCTS} onBarcodeAssigned={jest.fn()} {...props} />)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}

afterEach(async () => {
  // Démonter dans act() : la liste virtualisée planifie des mises à jour qui ne doivent pas survivre au test.
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

beforeEach(() => {
  mockRole = 'OWNER'
  print.mockClear()
  assignInternalBarcode.mockReset()
})

describe('écran Étiquettes (mobile) — test de fumée', () => {
  it('affiche les articles triés et le résumé vide quand rien n’est coché', async () => {
    const renderer = await render()
    const text = allText(renderer)
    expect(text).toContain('Savon de Marseille')
    expect(text).toContain('Café moulu')
    expect(text).toContain('Thé vert')
    expect(text.indexOf('Café moulu')).toBeLessThan(text.indexOf('Savon de Marseille')) // tri alphabétique
    expect(text).toContain('Sans code-barres')
  })

  it('article pré-sélectionné : 1 étiquette, 1 page, et le bouton Imprimer envoie le document au natif', async () => {
    const renderer = await render({ preselection: [{ productId: 'p1', copies: 3 }] })
    expect(allText(renderer)).toContain('3 étiquettes')
    expect(allText(renderer)).toContain('1 page')

    await press(renderer, 'Imprimer')
    expect(print).toHaveBeenCalledTimes(1)
    const [html, layout] = print.mock.calls[0]
    expect(html).toContain('Savon de Marseille')
    expect(html).toContain('12') // prix
    expect(html).toContain('<svg') // code-barres vectoriel
    expect(layout).toMatchObject({ pageWidthMm: 210, pageHeightMm: 297 }) // profil par défaut : A4
    expect((html.match(/class="cell/g) ?? []).length).toBe(3)
  })

  it('article sans code-barres : avertissement + « Générer un code » attribue le code et prévient le parent', async () => {
    assignInternalBarcode.mockResolvedValue({ id: 'p2', barcode: '2000000000015' })
    const onBarcodeAssigned = jest.fn()
    const renderer = await render({ preselection: [{ productId: 'p2', copies: 1 }], onBarcodeAssigned })
    expect(allText(renderer)).toContain('pas de code-barres')

    await press(renderer, 'Générer un code')
    await flush()
    expect(assignInternalBarcode).toHaveBeenCalledWith('p2')
    expect(onBarcodeAssigned).toHaveBeenCalledWith('p2', '2000000000015')
    expect(allText(renderer)).toContain('1 code généré')
  })

  it('hors ligne : message clair, aucun code attribué', async () => {
    assignInternalBarcode.mockRejectedValue(new NetworkError())
    const onBarcodeAssigned = jest.fn()
    const renderer = await render({ preselection: [{ productId: 'p2', copies: 1 }], onBarcodeAssigned })

    await press(renderer, 'Générer un code')
    await flush()
    expect(allText(renderer)).toContain('Connexion requise')
    expect(onBarcodeAssigned).not.toHaveBeenCalled()
  })

  it('un vendeur peut imprimer', async () => {
    mockRole = 'SELLER'
    const renderer = await render({ preselection: [{ productId: 'p1', copies: 1 }] })
    expect(allText(renderer)).toContain('Imprimer')
    expect(allText(renderer)).not.toContain('réservée')
  })

  it('un rôle non autorisé voit le message de restriction, sans liste ni bouton Imprimer', async () => {
    mockRole = 'APPRENTICE'
    const renderer = await render()
    const text = allText(renderer)
    expect(text).toContain('réservée au propriétaire et aux vendeurs')
    expect(text).not.toContain('Savon de Marseille')
  })

  it('sans promotion en cours : pas de bouton « Articles en promotion »', async () => {
    const renderer = await render()
    expect(allText(renderer)).not.toContain('Articles en promotion')
  })

  it('« Articles en promotion » coche les articles visés ; leurs étiquettes affichent l’ancien prix barré et le prix promo', async () => {
    getPromotions.mockResolvedValueOnce([
      { id: 'promo1', name: 'Soldes', type: 'PERCENTAGE', value: 20, currency: 'GNF', startDate: '2026-01-01T00:00:00Z', endDate: '2027-01-01T00:00:00Z', active: true, productIds: ['p1'], categoryIds: [], createdBy: 'u', createdAt: '2026-01-01T00:00:00Z' },
    ])
    const renderer = await render()
    expect(allText(renderer)).toContain('Articles en promotion (1)')

    await press(renderer, 'Articles en promotion (1)')
    expect(allText(renderer)).toContain('1 article sélectionné')
    await press(renderer, 'Imprimer')
    const html: string = print.mock.calls[0][0]
    expect(html).toContain('Savon de Marseille')
    expect(html.replace(/ /g, ' ')).toMatch(/10 000 GNF/) // 12 500 − 20 %
    expect(html).toContain('class="o"') // ancien prix barré
    expect(html).not.toContain('Thé vert')
  })

  it('« Tout sélectionner » puis l’impression couvre tout le catalogue', async () => {
    const renderer = await render()
    await press(renderer, 'Tout sélectionner')
    await press(renderer, 'Imprimer')
    const html: string = print.mock.calls[0][0]
    for (const name of ['Savon de Marseille', 'Café moulu', 'Thé vert']) expect(html).toContain(name)
    expect((html.match(/class="cell/g) ?? []).length).toBe(3)
  })
})
