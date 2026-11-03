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
jest.mock('../../lib/authApi', () => ({ authApi: { changeCostMethod: jest.fn() } }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { CostMethod } from '@boutiklic/shared'
import type { Tenant } from '../../hooks/useTenant'
import { authApi } from '../../lib/authApi'
import { allText, flush, press, textOf } from '../../testing/renderHelpers'
import CostMethodSettings from './CostMethodSettings'

const changeCostMethod = authApi.changeCostMethod as jest.Mock
const mounted: ReactTestRenderer[] = []

const TENANT = { id: 't1', name: 'Chez Fatou', currency: 'GNF' } as unknown as Tenant

async function render({ isOwner = true, costMethod = 'MANUAL' as CostMethod } = {}) {
  const onSaved = jest.fn()
  const onBack = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<CostMethodSettings onBack={onBack} tenant={{ ...TENANT, costMethod }} isOwner={isOwner} onSaved={onSaved} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onSaved, onBack }
}

const radio = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function' && textOf(n).includes(label))[0]

const isChecked = (renderer: ReactTestRenderer, label: string) => radio(renderer, label).props.accessibilityState.checked

beforeEach(() => {
  changeCostMethod.mockReset().mockResolvedValue({})
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

/** Étude prix décimaux, section 11, phase 7d : réglage propriétaire de ce qu'un arrivage fait au coût des articles. */
describe('réglage de la méthode de coût (mobile)', () => {
  it('propose les trois méthodes avec leur explication et coche celle de la boutique', async () => {
    const { renderer } = await render({ costMethod: 'WEIGHTED_AVERAGE' })

    const text = allText(renderer)
    expect(text).toContain('Méthode de coût')
    expect(text).toContain('Un arrivage ne change jamais le coût')
    expect(text).toContain('Le coût de l\'article devient celui du dernier arrivage.')
    expect(isChecked(renderer, 'Manuelle')).toBe(false)
    expect(isChecked(renderer, 'Dernier prix d\'achat')).toBe(false)
    expect(isChecked(renderer, 'Coût moyen pondéré')).toBe(true)
  })

  it('le propriétaire choisit la moyenne pondérée et enregistre : le serveur reçoit la méthode, la boutique est rechargée', async () => {
    const { renderer, onSaved } = await render()

    await act(async () => radio(renderer, 'Coût moyen pondéré').props.onPress())
    await press(renderer, 'Enregistrer les modifications')
    await flush()

    expect(changeCostMethod).toHaveBeenCalledWith('t1', 'WEIGHTED_AVERAGE')
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(allText(renderer)).toContain('Modifications enregistrées')
  })

  it('sans changement, le bouton « Enregistrer » est désactivé et rien n\'est envoyé', async () => {
    const { renderer } = await render()

    expect(renderer.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.disabled === true && textOf(n).includes('Enregistrer'))).not.toHaveLength(0)
    expect(changeCostMethod).not.toHaveBeenCalled()
  })

  it('refus du serveur : le message est affiché et le choix revient à la méthode réelle', async () => {
    changeCostMethod.mockRejectedValueOnce(new Error('Action réservée au propriétaire'))
    const { renderer, onSaved } = await render({ costMethod: 'LAST_PRICE' })

    await act(async () => radio(renderer, 'Manuelle').props.onPress())
    expect(isChecked(renderer, 'Manuelle')).toBe(true)
    await press(renderer, 'Enregistrer les modifications')
    await flush()

    expect(allText(renderer)).toContain('Action réservée au propriétaire')
    expect(isChecked(renderer, 'Dernier prix d\'achat')).toBe(true) // revenu à la méthode réelle de la boutique
    expect(isChecked(renderer, 'Manuelle')).toBe(false)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('un membre qui n\'est pas propriétaire voit l\'explication, ne peut rien choisir et n\'a pas de bouton', async () => {
    const { renderer } = await render({ isOwner: false })

    expect(allText(renderer)).toContain('Seul le propriétaire de la boutique peut modifier ce réglage.')
    await act(async () => radio(renderer, 'Coût moyen pondéré').props.onPress())
    expect(isChecked(renderer, 'Manuelle')).toBe(true) // le choix n'a pas bougé
    expect(allText(renderer)).not.toContain('Enregistrer les modifications')
    expect(changeCostMethod).not.toHaveBeenCalled()
  })
})
