// react-test-renderer et react-native résolvent React à la RACINE du monorepo, alors que le code de l'app pourrait
// résoudre la copie du dossier mobile : deux copies de React → « Invalid hook call ». On les aligne sur celle du renderer.
jest.mock('react', () => jest.requireActual(require.resolve('react', { paths: [require('path').dirname(require.resolve('react-test-renderer'))] })))
// Le babel de l'app compile le JSX vers le runtime NativeWind, introuvable depuis les fichiers react-native de la racine.
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'), { virtual: true })
jest.mock('react-native-css-interop/jsx-dev-runtime', () => jest.requireActual('react/jsx-dev-runtime'), { virtual: true })
// lucide-react-native est publié en ESM (non transformé par jest) : les icônes ne sont pas l'objet de ce test.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (target: Record<string, unknown>, prop: string) => (prop in target ? target[prop] : () => null) }))
// i18n réel (textes fr de l'app) mais sans expo-localization, dont le module natif n'est pas chargeable sous jest ici.
jest.mock('../i18n', () => {
  const { createInstance } = require('i18next')
  const { initReactI18next } = require('react-i18next')
  const i18n = createInstance()
  i18n.use(initReactI18next).init({ lng: 'fr', fallbackLng: 'fr', resources: { fr: { translation: require('../i18n/locales/fr.json') } }, interpolation: { escapeValue: false } })
  return { __esModule: true, default: i18n }
})

import '../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { allText, flush, press, textOf } from '../testing/renderHelpers'
import TaxChoice from './TaxChoice'

const mounted: ReactTestRenderer[] = []

async function render(applyTax: boolean) {
  const setApplyTax = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<TaxChoice applyTax={applyTax} setApplyTax={setApplyTax} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, setApplyTax }
}

const radio = (renderer: ReactTestRenderer, label: string) =>
  renderer.root.findAll((n) => n.props.accessibilityRole === 'radio' && typeof n.props.onPress === 'function' && textOf(n).startsWith(label))[0]

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('choix « Appliquez-vous la TVA ? » à la création de la boutique', () => {
  it('pose la question et explique chaque réponse, sans parler de taux à 0 %', async () => {
    const { renderer } = await render(false)

    const text = allText(renderer)
    expect(text).toContain('Appliquez-vous la TVA à vos ventes ?')
    expect(text).toContain('sans ligne de TVA sur le ticket')
    expect(text).toContain('Le ticket détaille HT, TVA et TTC')
    expect(text).toContain('Vous pourrez changer cela à tout moment dans Réglages.')
  })

  it('« Non » est coché quand la TVA n\'est pas appliquée (valeur par défaut des écrans de création)', async () => {
    const { renderer } = await render(false)

    expect(radio(renderer, 'Non').props.accessibilityState.checked).toBe(true)
    expect(radio(renderer, 'Oui').props.accessibilityState.checked).toBe(false)
  })

  it('choisir « Oui » active la TVA, revenir à « Non » la désactive', async () => {
    const yes = await render(false)
    await act(async () => radio(yes.renderer, 'Oui').props.onPress())
    expect(yes.setApplyTax).toHaveBeenCalledWith(true)

    const no = await render(true)
    expect(radio(no.renderer, 'Oui').props.accessibilityState.checked).toBe(true)
    await press(no.renderer, 'Non')
    expect(no.setApplyTax).toHaveBeenCalledWith(false)
  })
})
