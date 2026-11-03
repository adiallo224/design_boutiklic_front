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
jest.mock('../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
jest.mock('../../lib/categoriesApi', () => ({
  categoriesApi: { create: jest.fn(), update: jest.fn(), remove: jest.fn(), reorder: jest.fn(), changeTaxCategory: jest.fn() },
}))
jest.mock('../../lib/taxApi', () => ({
  taxApi: {
    getActiveCategories: jest.fn().mockResolvedValue([
      { id: 'tax-standard', name: 'Standard', active: true, ratePercent: 18 },
      { id: 'tax-reduced', name: 'Réduit', active: true, ratePercent: 5.5 },
    ]),
  },
}))
jest.mock('../../lib/productsApi', () => ({ productsApi: { deactivate: jest.fn(), changeCategory: jest.fn() } }))
jest.mock('../../hooks/useTenant', () => ({
  useTenant: () => ({ formatUnitPrice: (n: number) => String(n), tenant: { taxEnabled: true, defaultTaxCategoryId: 'tax-standard' } }),
}))
// Le menu déroulant natif n'est pas l'objet du test : on capte ses props pour déclencher onChange.
const mockSelects: Array<{ onChange: (value: string) => void; options: Array<{ label: string; value: string }> }> = []
jest.mock('../../components/SelectField', () => ({
  __esModule: true,
  default: (props: { onChange: (value: string) => void; options: Array<{ label: string; value: string }> }) => {
    mockSelects.push(props)
    return null
  },
}))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Product } from '../../types'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { productsApi } from '../../lib/productsApi'
import { allText, flush, press, typeInto } from '../../testing/renderHelpers'
import Categories from './Categories'
import CategoryDetail from './CategoryDetail'
import UnclassifiedProducts from './UnclassifiedProducts'

const api = categoriesApi as unknown as Record<'create' | 'update' | 'remove' | 'reorder' | 'changeTaxCategory', jest.Mock>
const changeCategory = productsApi.changeCategory as jest.Mock
const mounted: ReactTestRenderer[] = []

const cat = (id: string, name: string, position: number, extra: Partial<CategoryResponse> = {}): CategoryResponse => ({
  id,
  name,
  color: '#C0553A',
  icon: 'local_grocery_store',
  parentId: null,
  depth: 1,
  position,
  ...extra,
})

const product = (id: string, name: string, categoryId?: string): Product => ({
  id,
  name,
  category: 'x',
  categoryId,
  purchasePrice: 1,
  salePrice: 2,
  currency: 'GNF',
  imageUrls: [],
  quantity: 3,
  alertThreshold: 1,
  lastRestockAt: null,
  isFavorite: false,
  isActive: true,
})

async function mount(element: React.ReactElement) {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(element)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}

const byLabel = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function')

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue(undefined))
  changeCategory.mockReset().mockResolvedValue({})
  mockSelects.length = 0
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('liste des catégories (mobile)', () => {
  const baseProps = () => ({
    onBack: jest.fn(),
    categories: [cat('c1', 'Alimentation', 0), cat('c2', 'Boissons', 1)],
    products: [product('p1', 'Riz', 'c1'), product('p2', 'Cahier')],
    isOwner: true,
    onCategoriesChanged: jest.fn().mockResolvedValue(undefined),
    onSelectCategory: jest.fn(),
    onOpenUnclassified: jest.fn(),
  })

  it('descendre une catégorie envoie l’ordre complet des frères puis recharge', async () => {
    const props = baseProps()
    const renderer = await mount(<Categories {...props} />)

    await act(async () => byLabel(renderer, 'Descendre')[0].props.onPress())

    expect(api.reorder).toHaveBeenCalledWith(null, ['c2', 'c1'])
    expect(props.onCategoriesChanged).toHaveBeenCalled()
  })

  it('« Sous-catégorie » crée avec un nom par défaut, hérite couleur/icône du parent, puis ouvre la fiche', async () => {
    const props = { ...baseProps(), categories: [cat('c1', 'Alimentation', 0)] }
    const created = cat('new', 'Nouvelle sous-catégorie', 0, { parentId: 'c1', depth: 2 })
    api.create.mockResolvedValue(created)
    const renderer = await mount(<Categories {...props} />)

    await press(renderer, 'Sous-catégorie')

    expect(api.create).toHaveBeenCalledWith({ name: 'Nouvelle sous-catégorie', color: '#C0553A', icon: 'local_grocery_store', parentId: 'c1' })
    expect(props.onSelectCategory).toHaveBeenCalledWith(created)
  })

  it('le nom par défaut évite un doublon (la création fusionne sinon sur le nom)', async () => {
    const props = { ...baseProps(), categories: [cat('c1', 'Alimentation', 0), cat('s1', 'Nouvelle sous-catégorie', 0, { parentId: 'c1', depth: 2 })] }
    api.create.mockResolvedValue(cat('new', 'x', 1))
    const renderer = await mount(<Categories {...props} />)

    await press(renderer, 'Sous-catégorie')

    expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nouvelle sous-catégorie 2' }))
  })

  it('« Non classés » affiche le nombre d’articles sans catégorie et ouvre l’écran dédié', async () => {
    const props = baseProps()
    const renderer = await mount(<Categories {...props} />)

    expect(allText(renderer)).toContain('Non classés')
    await press(renderer, 'Non classés')

    expect(props.onOpenUnclassified).toHaveBeenCalled()
  })

  it('un non-propriétaire ne voit ni ordre ni création de sous-catégorie', async () => {
    const renderer = await mount(<Categories {...baseProps()} isOwner={false} />)

    expect(byLabel(renderer, 'Descendre')).toHaveLength(0)
    expect(allText(renderer)).not.toContain('Sous-catégorie')
  })
})

describe('fiche catégorie (mobile)', () => {
  const baseProps = (isOwner = true) => ({
    category: cat('c1', 'Alimentation', 0),
    categories: [cat('c1', 'Alimentation', 0), cat('s1', 'Riz', 0, { parentId: 'c1', depth: 2 })],
    products: [product('p1', 'Sucre', 'c1'), product('p2', 'Riz parfumé', 's1')],
    isOwner,
    onBack: jest.fn(),
    onAdd: jest.fn(),
    onProductDeleted: jest.fn(),
    onCategoriesChanged: jest.fn().mockResolvedValue(undefined),
    onDeleted: jest.fn(),
  })

  it('renommer envoie la fiche complète en gardant le parent actuel', async () => {
    const props = baseProps()
    const renderer = await mount(<CategoryDetail {...props} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await typeInto(renderer, renderer.root.findAllByType(TextInput), 0, '  Épicerie ')
    await press(renderer, 'Enregistrer')

    expect(api.update).toHaveBeenCalledWith('c1', { name: 'Épicerie', color: '#C0553A', icon: 'local_grocery_store', parentId: null })
    expect(props.onCategoriesChanged).toHaveBeenCalled()
  })

  it('choisir une couleur enregistre tout de suite', async () => {
    const renderer = await mount(<CategoryDetail {...baseProps()} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await act(async () => byLabel(renderer, '#D32F2F')[0].props.onPress())

    expect(api.update).toHaveBeenCalledWith('c1', expect.objectContaining({ color: '#D32F2F' }))
  })

  it('choisir une icône enregistre sa clé (pas l’emoji)', async () => {
    const renderer = await mount(<CategoryDetail {...baseProps()} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await act(async () => byLabel(renderer, 'cleaning_services')[0].props.onPress())

    expect(api.update).toHaveBeenCalledWith('c1', expect.objectContaining({ icon: 'cleaning_services' }))
  })

  it('supprimer demande confirmation avec l’impact, puis supprime et prévient l’écran appelant', async () => {
    const props = baseProps()
    const renderer = await mount(<CategoryDetail {...props} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await press(renderer, 'Supprimer la catégorie')
    // Seuls les articles DIRECTS repassent « Non classés » (1 : « Sucre ») ; la sous-catégorie remonte avec « Riz parfumé ».
    expect(allText(renderer)).toContain('Supprimer « Alimentation » ?')
    expect(allText(renderer)).toContain('1 article(s) seront déplacés vers « Non classés ».')
    expect(allText(renderer)).toContain('1 sous-catégorie(s) remonteront au niveau supérieur.')
    expect(api.remove).not.toHaveBeenCalled()

    await press(renderer, 'Confirmer')

    expect(api.remove).toHaveBeenCalledWith('c1')
    expect(props.onDeleted).toHaveBeenCalled()
  })

  it('un refus du serveur (ex. nom déjà pris) s’affiche et recharge l’état serveur', async () => {
    api.update.mockRejectedValue(new Error('Une catégorie porte déjà ce nom : Boissons'))
    const props = baseProps()
    const renderer = await mount(<CategoryDetail {...props} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await typeInto(renderer, renderer.root.findAllByType(TextInput), 0, 'Boissons')
    await press(renderer, 'Enregistrer')

    expect(allText(renderer)).toContain('Une catégorie porte déjà ce nom : Boissons')
    expect(props.onCategoriesChanged).toHaveBeenCalled()
  })

  const taxOption = (renderer: ReactTestRenderer, label: string) =>
    renderer.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function'
      && n.findAll((c) => c.children.includes(label)).length > 0)

  it('la TVA propre : l’option vide dit ce qui est hérité (défaut de la boutique)', async () => {
    const renderer = await mount(<CategoryDetail {...baseProps()} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    expect(allText(renderer)).toContain('Hérité de la boutique (18 %)')
  })

  it('choisir un taux fixe la TVA propre de la catégorie', async () => {
    const props = baseProps()
    const renderer = await mount(<CategoryDetail {...props} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await act(async () => taxOption(renderer, 'Réduit (5.5 %)')[0].props.onPress())

    expect(api.changeTaxCategory).toHaveBeenCalledWith('c1', 'tax-reduced')
    expect(props.onCategoriesChanged).toHaveBeenCalled()
  })

  it('revenir à « Hérité » retire la TVA propre', async () => {
    const props = { ...baseProps(), category: cat('c1', 'Alimentation', 0, { taxCategoryId: 'tax-reduced' }) }
    const renderer = await mount(<CategoryDetail {...props} />)
    await act(async () => byLabel(renderer, 'Modifier')[0].props.onPress())

    await act(async () => taxOption(renderer, 'Hérité de la boutique (18 %)')[0].props.onPress())

    expect(api.changeTaxCategory).toHaveBeenCalledWith('c1', null)
  })

  it('un non-propriétaire ne peut ni modifier ni supprimer', async () => {
    const renderer = await mount(<CategoryDetail {...baseProps(false)} />)

    expect(byLabel(renderer, 'Modifier')).toHaveLength(0)
    expect(allText(renderer)).not.toContain('Supprimer la catégorie')
  })
})

describe('articles non classés (mobile)', () => {
  const baseProps = (isOwner = true) => ({
    categories: [cat('c1', 'Alimentation', 0), cat('s1', 'Riz', 0, { parentId: 'c1', depth: 2 })],
    products: [product('p1', 'Sucre', 'c1'), product('p2', 'Cahier'), product('p3', 'Stylo')],
    isOwner,
    onBack: jest.fn(),
    onChanged: jest.fn().mockResolvedValue(undefined),
  })

  it('liste uniquement les articles sans catégorie', async () => {
    const renderer = await mount(<UnclassifiedProducts {...baseProps()} />)

    const text = allText(renderer)
    expect(text).toContain('Cahier')
    expect(text).toContain('Stylo')
    expect(text).not.toContain('Sucre')
    expect(text).toContain('2 articles sans catégorie')
  })

  it('« Classer dans… » reclasse l’article sans toucher au reste de la fiche, puis recharge', async () => {
    const props = baseProps()
    await mount(<UnclassifiedProducts {...props} />)

    // Un menu par article : le premier est celui de « Cahier ».
    expect(mockSelects[0].options.map((o) => o.value)).toEqual(['c1', 's1'])
    await act(async () => mockSelects[0].onChange('s1'))

    expect(changeCategory).toHaveBeenCalledWith('p2', 's1')
    expect(props.onChanged).toHaveBeenCalled()
  })

  it('lecture seule pour un non-propriétaire', async () => {
    await mount(<UnclassifiedProducts {...baseProps(false)} />)

    expect(mockSelects).toHaveLength(0)
  })
})
