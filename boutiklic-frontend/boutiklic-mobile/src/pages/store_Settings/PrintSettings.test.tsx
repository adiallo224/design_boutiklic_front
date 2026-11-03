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
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
let mockUuid = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }))
jest.mock('../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
jest.mock('../../lib/printLabels', () => ({ printLabelsDocument: jest.fn().mockResolvedValue(undefined) }))

import React from 'react'
import { TextInput } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { getActiveProfile } from '@boutiklic/shared'
import { printLabelsDocument } from '../../lib/printLabels'
import { __resetPrintSettingsStoreForTests, getPrintSettings } from '../../lib/printSettingsStore'
import { allText, flush, press, typeInto } from '../../testing/renderHelpers'
import PrintSettings from './PrintSettings'

const print = printLabelsDocument as jest.Mock
const mounted: ReactTestRenderer[] = []

async function render() {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<PrintSettings onBack={jest.fn()} />)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}
const inputs = (renderer: ReactTestRenderer) => renderer.root.findAllByType(TextInput)

beforeEach(async () => {
  await AsyncStorage.clear()
  __resetPrintSettingsStoreForTests()
  mockUuid = 0
  print.mockClear()
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('écran Imprimantes (mobile) — liste', () => {
  it('appareil neuf : un profil « A4 » par défaut, marqué Par défaut, non supprimable (le dernier)', async () => {
    const renderer = await render()
    const text = allText(renderer)
    expect(text).toContain('Imprimantes')
    expect(text).toContain('Par défaut')
    expect(text).toContain('Petit format – 24 par page')
    expect(text).toContain('24 étiquettes par page')
    expect(text).toContain('Gardez au moins une imprimante.')
  })

  it('« Page d’essai » imprime une page pleine avec le format du profil', async () => {
    const renderer = await render()
    await press(renderer, "Page d'essai")
    expect(print).toHaveBeenCalledTimes(1)
    const [html, layout] = print.mock.calls[0]
    expect(layout).toMatchObject({ pageWidthMm: 210, pageHeightMm: 297 })
    expect((html.match(/class="cell cut"/g) ?? []).length).toBe(24)
    expect(html).toContain("Étiquette d'essai")
  })
})

describe('écran Imprimantes (mobile) — éditeur', () => {
  it('ajoute une imprimante thermique et revient à la liste avec elle', async () => {
    const renderer = await render()
    await press(renderer, 'Ajouter une imprimante')
    expect(allText(renderer)).toContain('Nouvelle imprimante')

    await typeInto(renderer, inputs(renderer), 0, 'Caisse Xprinter')
    await press(renderer, 'Imprimante thermique (rouleau)')
    expect(allText(renderer)).toContain('Rouleau 50 × 30 mm')

    await press(renderer, 'Enregistrer')
    await flush()

    // retour à la liste : les deux imprimantes sont là, la nouvelle est persistée
    const text = allText(renderer)
    expect(text).toContain('Caisse Xprinter')
    expect(text).toContain('Imprimante thermique (rouleau)')
    const saved = getPrintSettings().profiles.find((p) => p.name === 'Caisse Xprinter')!
    expect(saved).toMatchObject({ kind: 'THERMAL_ROLL', presetId: 'roll-50x30', dpi: 203 })
    expect(JSON.parse((await AsyncStorage.getItem('boutiklic_print_settings')) as string).profiles).toHaveLength(2)
  })

  it('nom vide : « Enregistrer » ne crée rien et demande un nom', async () => {
    const renderer = await render()
    await press(renderer, 'Ajouter une imprimante')
    await press(renderer, 'Enregistrer')
    expect(allText(renderer)).toContain("Donnez un nom à l'imprimante.")
    expect(getPrintSettings().profiles).toHaveLength(1)
  })

  it('la page d’essai marche avant d’enregistrer, même sans nom', async () => {
    const renderer = await render()
    await press(renderer, 'Ajouter une imprimante')
    await press(renderer, "Page d'essai")
    expect(print).toHaveBeenCalledTimes(1)
    expect(getPrintSettings().profiles).toHaveLength(1) // rien enregistré
  })

  it('décalage non numérique : le format est déclaré invalide et l’enregistrement est bloqué', async () => {
    const renderer = await render()
    await press(renderer, 'Ajouter une imprimante')
    await typeInto(renderer, inputs(renderer), 0, 'Rayon')
    // champs : 0 = nom, 1 = décalage horizontal, 2 = décalage vertical (format non personnalisé)
    await typeInto(renderer, inputs(renderer), 1, 'beaucoup')
    expect(allText(renderer)).toContain('Ces dimensions ne tiennent pas sur la page')
    await press(renderer, 'Enregistrer')
    expect(getPrintSettings().profiles).toHaveLength(1)
  })

  it('supprime une imprimante après confirmation ; la restante devient l’imprimante par défaut', async () => {
    const renderer = await render()
    await press(renderer, 'Ajouter une imprimante')
    await typeInto(renderer, inputs(renderer), 0, 'Deuxième')
    await press(renderer, 'Enregistrer')
    await flush()
    expect(getPrintSettings().profiles).toHaveLength(2)

    // le bouton corbeille porte le libellé d'accessibilité « Supprimer » ; on cible le 1er profil (« A4 »)
    const trash = renderer.root.findAll((n) => n.props.accessibilityLabel === 'Supprimer' && typeof n.props.onPress === 'function')
    await act(async () => {
      trash[0].props.onPress()
    })
    expect(allText(renderer)).toContain('Supprimer « A4 » ?')
    await press(renderer, 'Supprimer')
    await flush()
    const settings = getPrintSettings()
    expect(settings.profiles.map((p) => p.name)).toEqual(['Deuxième'])
    expect(getActiveProfile(settings).name).toBe('Deuxième')
  })
})
