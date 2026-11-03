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
let mockRole = 'OWNER'
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: mockRole, tenantId: 't1' } }) }))
jest.mock('../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
jest.mock('../../lib/stockCountsApi', () => ({ stockCountsApi: { list: jest.fn(), start: jest.fn() } }))
jest.mock('../../lib/depotsApi', () => ({
  depotsApi: { getAll: jest.fn().mockResolvedValue([{ id: 'd1', name: 'Dépôt principal', isDefault: true, active: true, createdAt: '2026-01-01T00:00:00Z' }]) },
}))
jest.mock('../../lib/categoriesApi', () => ({ categoriesApi: { getAll: jest.fn().mockResolvedValue([]) } }))
jest.mock('../../components/SelectField', () => ({ __esModule: true, default: () => null }))
// Le détail a ses propres tests : ici on vérifie seulement qu'il s'ouvre sur le bon comptage.
jest.mock('./StockCountDetail', () => ({ __esModule: true, default: ({ countId }: { countId: string }) => `DETAIL:${countId}` }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { stockCountsApi, type StockCountResponse } from '../../lib/stockCountsApi'
import { allText, flush, press } from '../../testing/renderHelpers'
import StockCounts from './StockCounts'

const api = stockCountsApi as unknown as Record<'list' | 'start', jest.Mock>
const mounted: ReactTestRenderer[] = []

function aCount(overrides: Partial<StockCountResponse> = {}): StockCountResponse {
  return {
    id: 'c1', depotId: 'd1', categoryId: null, blind: true, status: 'COUNTING', snapshotAt: '2026-10-24T09:00:00Z', createdBy: 'u1', validatedBy: null,
    note: null, createdAt: '2026-10-24T09:00:00Z', validatedAt: null, lineCount: 12, countedCount: 5, lines: null, ...overrides,
  }
}

/** Le bouton « + » n'a qu'une icône : on le trouve par son libellé d'accessibilité. */
const newCountButtons = (renderer: ReactTestRenderer) =>
  renderer.root.findAll((n) => n.props.accessibilityLabel === 'Nouveau comptage' && typeof n.props.onPress === 'function')

async function openStartModal(renderer: ReactTestRenderer) {
  const button = newCountButtons(renderer)[0]
  await act(async () => {
    button.props.onPress()
  })
}

async function render() {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<StockCounts onBack={jest.fn()} />)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}

beforeEach(() => {
  mockRole = 'OWNER'
  api.list.mockReset().mockResolvedValue([])
  api.start.mockReset()
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('inventaire physique (mobile) — liste des comptages', () => {
  it('sans comptage, invite le propriétaire à en lancer un', async () => {
    const renderer = await render()

    expect(newCountButtons(renderer).length).toBeGreaterThan(0)    // garde le test « vendeur » ci-dessous discriminant
    expect(allText(renderer)).toContain('Aucun comptage pour l\'instant.')
    expect(allText(renderer)).toContain('Lancez un comptage')
  })

  it('affiche chaque comptage avec son dépôt, son statut et son avancement', async () => {
    api.list.mockResolvedValue([aCount(), aCount({ id: 'c2', status: 'VALIDATED', countedCount: 12 })])
    const renderer = await render()

    const text = allText(renderer)
    expect(text).toContain('Dépôt principal')
    expect(text).toContain('Comptage en cours')
    expect(text).toContain('5 / 12 comptés')
    expect(text).toContain('Validé')
    expect(text).toContain('12 / 12 comptés')
  })

  it('toucher un comptage ouvre son détail', async () => {
    api.list.mockResolvedValue([aCount()])
    const renderer = await render()

    await press(renderer, 'Dépôt principal')

    expect(allText(renderer)).toContain('DETAIL:c1')
  })

  it('le propriétaire lance un comptage aveugle sur le dépôt par défaut, et arrive sur son détail', async () => {
    api.start.mockResolvedValue(aCount({ id: 'new-count' }))
    const renderer = await render()

    await openStartModal(renderer)
    await press(renderer, 'Lancer le comptage')
    await flush()

    expect(api.start).toHaveBeenCalledWith({ depotId: undefined, categoryId: undefined, blind: true, note: undefined })
    expect(allText(renderer)).toContain('DETAIL:new-count')
  })

  it('un comptage déjà ouvert sur le dépôt empêche d\'en lancer un second', async () => {
    api.list.mockResolvedValue([aCount()])
    const renderer = await render()

    await openStartModal(renderer)
    expect(allText(renderer)).toContain('Un comptage est déjà en cours sur ce dépôt.')
    await press(renderer, 'Lancer le comptage')
    expect(api.start).not.toHaveBeenCalled()
  })

  it('un vendeur voit la liste mais n\'a pas le bouton « Nouveau comptage »', async () => {
    mockRole = 'SELLER'
    const renderer = await render()

    expect(newCountButtons(renderer)).toHaveLength(0)
    expect(allText(renderer)).not.toContain('Lancez un comptage')
  })
})
