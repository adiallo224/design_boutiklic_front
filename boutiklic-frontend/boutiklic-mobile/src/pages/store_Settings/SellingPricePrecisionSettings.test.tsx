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
jest.mock('../../lib/productsApi', () => ({ productsApi: { changeSellingPriceDecimals: jest.fn() } }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Tenant } from '../../hooks/useTenant'
import { productsApi } from '../../lib/productsApi'
import { allText, flush, press, textOf } from '../../testing/renderHelpers'
import SellingPricePrecisionSettings from './SellingPricePrecisionSettings'

const changeDecimals = productsApi.changeSellingPriceDecimals as jest.Mock
const mounted: ReactTestRenderer[] = []

const TENANT = { id: 't1', name: 'Chez Fatou', currency: 'GNF', sellingPriceDecimals: 0 } as unknown as Tenant

async function render({ isOwner = true, sellingPriceDecimals = 0 } = {}) {
  const onSaved = jest.fn()
  const onBack = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(
      <SellingPricePrecisionSettings onBack={onBack} tenant={{ ...TENANT, sellingPriceDecimals }} isOwner={isOwner} onSaved={onSaved} />,
    )
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onSaved, onBack }
}

const radio = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function' && textOf(n).includes(label))[0]

const isChecked = (renderer: ReactTestRenderer, label: string) => radio(renderer, label).props.accessibilityState.checked

beforeEach(() => {
  changeDecimals.mockReset().mockResolvedValue({ sellingPriceDecimals: 2 })
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

/** Étude prix décimaux, phase 5bis : réglage propriétaire de la précision des prix de vente (la devise reste figée). */
describe('réglage de la précision des prix de vente (mobile)', () => {
  it('propose 0, 1 ou 2 décimales et coche la précision actuelle de la boutique', async () => {
    const { renderer } = await render({ sellingPriceDecimals: 1 })

    expect(allText(renderer)).toContain('Décimales sur les prix de vente')
    expect(isChecked(renderer, 'Aucune')).toBe(false)
    expect(isChecked(renderer, '1 décimale')).toBe(true)
    expect(isChecked(renderer, '2 décimales')).toBe(false)
  })

  it('le propriétaire choisit 2 décimales et enregistre : le serveur reçoit 2, la boutique est rechargée', async () => {
    const { renderer, onSaved } = await render()

    await act(async () => radio(renderer, '2 décimales').props.onPress())
    await press(renderer, 'Enregistrer les modifications')
    await flush()

    expect(changeDecimals).toHaveBeenCalledWith(2)
    expect(onSaved).toHaveBeenCalledTimes(1)
    expect(allText(renderer)).toContain('Modifications enregistrées')
  })

  it('sans changement, le bouton « Enregistrer » est désactivé et rien n’est envoyé', async () => {
    const { renderer } = await render()

    expect(renderer.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.disabled === true && textOf(n).includes('Enregistrer'))).not.toHaveLength(0)
    expect(changeDecimals).not.toHaveBeenCalled()
  })

  it('refus du serveur (articles à prix décimal) : le message est affiché et le choix revient à la valeur réelle', async () => {
    changeDecimals.mockRejectedValueOnce(new Error('3 article(s) actif(s) ont un prix avec plus de 0 décimale(s)'))
    const { renderer, onSaved } = await render({ sellingPriceDecimals: 2 })

    await act(async () => radio(renderer, 'Aucune').props.onPress())
    expect(isChecked(renderer, 'Aucune')).toBe(true)
    await press(renderer, 'Enregistrer les modifications')
    await flush()

    expect(allText(renderer)).toContain('3 article(s) actif(s)')
    expect(isChecked(renderer, '2 décimales')).toBe(true) // revenu à la précision réelle de la boutique
    expect(isChecked(renderer, 'Aucune')).toBe(false)
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('un membre qui n’est pas propriétaire voit l’explication, ne peut rien choisir et n’a pas de bouton', async () => {
    const { renderer } = await render({ isOwner: false })

    expect(allText(renderer)).toContain('Seul le propriétaire de la boutique peut modifier ce réglage.')
    await act(async () => radio(renderer, '2 décimales').props.onPress())
    expect(isChecked(renderer, 'Aucune')).toBe(true) // le choix n'a pas bougé
    expect(allText(renderer)).not.toContain('Enregistrer les modifications')
  })
})
