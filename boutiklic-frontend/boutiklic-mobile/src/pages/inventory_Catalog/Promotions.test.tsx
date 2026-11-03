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
jest.mock('../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { id: 't1', name: 'Chez Fatou', currency: 'GNF' } }) }))
jest.mock('../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
jest.mock('../../lib/categoriesApi', () => ({ categoriesApi: { getAll: jest.fn().mockResolvedValue([{ id: 'c2', name: 'Cosmétique', color: '#7B5EA7', icon: '🧴', parentId: null, depth: 1 }]) } }))
jest.mock('../../lib/promotionsApi', () => ({ promotionsApi: { getAll: jest.fn(), update: jest.fn(), create: jest.fn(), remove: jest.fn(), setActive: jest.fn() } }))
jest.mock('../../components/DateField', () => ({ __esModule: true, default: () => null }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Product } from '../../types'
import { promotionsApi } from '../../lib/promotionsApi'
import { allText, flush, press } from '../../testing/renderHelpers'
import Promotions from './Promotions'

const getAll = promotionsApi.getAll as jest.Mock
const mounted: ReactTestRenderer[] = []

const DAY = 24 * 3600 * 1000
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString()

const promo = (overrides: Record<string, unknown> = {}) => ({
  id: 'promo',
  name: 'Soldes',
  type: 'PERCENTAGE',
  value: 20,
  currency: 'GNF',
  startDate: iso(-10),
  endDate: iso(10),
  active: true,
  productIds: ['p1'],
  categoryIds: ['c2'],
  createdBy: 'u1',
  createdAt: iso(-11),
  ...overrides,
})

const product = (id: string, name: string, categoryId?: string, isActive = true): Product => ({
  id,
  name,
  category: categoryId ? 'Cat' : 'Sans catégorie',
  categoryId,
  purchasePrice: 700,
  salePrice: 1000,
  currency: 'GNF',
  quantity: 5,
  alertThreshold: 1,
  lastRestockAt: null,
  isFavorite: false,
  isActive,
})

// p1 : ciblé directement ; p2, p3 : catégorie c2 ; p4 : catégorie c2 mais désactivé ; p5 : non ciblé
const PRODUCTS = [product('p1', 'Savon', 'c1'), product('p2', 'Crème', 'c2'), product('p3', 'Lait', 'c2'), product('p4', 'Ancien', 'c2', false), product('p5', 'Thé', 'c9')]

async function render(promotions: unknown[], props: Partial<React.ComponentProps<typeof Promotions>> = {}) {
  getAll.mockResolvedValue(promotions)
  const onPrintLabels = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<Promotions onBack={jest.fn()} products={PRODUCTS} isOwner canPrintLabels onPrintLabels={onPrintLabels} {...props} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onPrintLabels }
}

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('promotions (mobile) — étiquettes promo', () => {
  it('promotion en cours : bouton « Étiquettes (n) », n = articles actifs visés (produit direct + catégorie)', async () => {
    const { renderer, onPrintLabels } = await render([promo()])
    expect(allText(renderer)).toContain('Étiquettes (3)') // p1 + p2 + p3 ; p4 est désactivé, p5 non ciblé

    await press(renderer, 'Étiquettes (3)')
    expect(onPrintLabels).toHaveBeenCalledTimes(1)
    const items = onPrintLabels.mock.calls[0][0]
    expect(items.map((i: { productId: string }) => i.productId).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(items.every((i: { copies: number }) => i.copies === 1)).toBe(true)
  })

  it('promotion en pause : pas de bouton (l’étiquette n’aurait pas de prix promo)', async () => {
    const { renderer } = await render([promo({ active: false })])
    expect(allText(renderer)).not.toContain('Étiquettes (')
  })

  it('promotion à venir : pas de bouton', async () => {
    const { renderer } = await render([promo({ startDate: iso(2), endDate: iso(20) })])
    expect(allText(renderer)).not.toContain('Étiquettes (')
  })

  it('promotion expirée : pas de bouton', async () => {
    const { renderer } = await render([promo({ startDate: iso(-20), endDate: iso(-2) })])
    expect(allText(renderer)).not.toContain('Étiquettes (')
  })

  it('promotion sans article actif visé : pas de bouton', async () => {
    const { renderer } = await render([promo({ productIds: ['inconnu'], categoryIds: ['c-vide'] })])
    expect(allText(renderer)).not.toContain('Étiquettes (')
  })

  it('rôle qui ne peut pas imprimer : pas de bouton', async () => {
    const { renderer } = await render([promo()], { canPrintLabels: false })
    expect(allText(renderer)).not.toContain('Étiquettes (')
  })

  it('un vendeur (pas propriétaire) voit le bouton mais pas les actions de gestion', async () => {
    const { renderer } = await render([promo()], { isOwner: false })
    expect(allText(renderer)).toContain('Étiquettes (3)')
    expect(allText(renderer)).not.toContain('Mettre en pause')
  })

  it('le propriétaire voit à la fois les actions de gestion et le bouton Étiquettes', async () => {
    const { renderer } = await render([promo()])
    expect(allText(renderer)).toContain('Mettre en pause')
    expect(allText(renderer)).toContain('Étiquettes (3)')
  })
})
