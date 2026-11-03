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
jest.mock('../../lib/taxApi', () => ({
  taxApi: {
    getActiveCategories: jest.fn(), create: jest.fn(), changeRate: jest.fn(), configure: jest.fn(),
    getCountryRates: jest.fn(), importCountryRate: jest.fn(), followOfficialRate: jest.fn(),
  },
}))
jest.mock('../../lib/authApi', () => ({ authApi: { changeCountry: jest.fn() } }))
// Le menu déroulant natif n'est pas l'objet du test : on capte ses props pour déclencher onChange.
const mockSelects: Array<{ onChange: (value: string) => void; value: string }> = []
jest.mock('../../components/SelectField', () => ({
  __esModule: true,
  default: (props: { onChange: (value: string) => void; value: string }) => {
    mockSelects.push(props)
    return null
  },
}))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { Switch, TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { Tenant } from '../../hooks/useTenant'
import { taxApi } from '../../lib/taxApi'
import { authApi } from '../../lib/authApi'
import { allText, flush, press, textOf, typeInto } from '../../testing/renderHelpers'
import TaxSettings from './TaxSettings'

const api = taxApi as unknown as Record<'getActiveCategories' | 'create' | 'changeRate' | 'configure' | 'getCountryRates' | 'importCountryRate' | 'followOfficialRate', jest.Mock>
const changeCountry = authApi.changeCountry as jest.Mock
const mounted: ReactTestRenderer[] = []

const STANDARD = { id: 'tax-standard', name: 'TVA normale', active: true, ratePercent: 18 }
const TENANT = { id: 't1', name: 'Chez Fatou', currency: 'GNF' } as unknown as Tenant

async function render({ isOwner = true, taxEnabled = false, defaultTaxCategoryId = null as string | null } = {}) {
  const onSaved = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<TaxSettings onBack={jest.fn()} tenant={{ ...TENANT, taxEnabled, defaultTaxCategoryId }} isOwner={isOwner} onSaved={onSaved} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onSaved }
}

beforeEach(() => {
  Object.values(api).forEach((fn) => fn.mockReset().mockResolvedValue(undefined))
  api.getActiveCategories.mockResolvedValue([STANDARD])
  api.getCountryRates.mockResolvedValue({
    country: 'GN',
    rates: [
      { code: 'STANDARD', name: 'TVA normale', ratePercent: 18, imported: true },
      { code: 'REDUCED', name: 'TVA réduite', ratePercent: 5.5, imported: false },
    ],
  })
  changeCountry.mockReset().mockResolvedValue({})
  mockSelects.length = 0
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('réglage de la TVA (mobile)', () => {
  it('liste les taux avec leur pourcentage et dit que la TVA n\'est pas appliquée', async () => {
    const { renderer } = await render({ defaultTaxCategoryId: 'tax-standard' })

    const text = allText(renderer)
    expect(text).toContain('TVA non appliquée')
    expect(text).toContain('TVA normale')
    expect(text).toContain('18 %')
  })

  it('sans aucun taux, l\'interrupteur est bloqué et l\'écran explique qu\'il faut en ajouter un', async () => {
    api.getActiveCategories.mockResolvedValue([])
    const { renderer } = await render()

    expect(renderer.root.findAllByType(Switch)[0].props.disabled).toBe(true)
    expect(allText(renderer)).toContain('Ajoutez d\'abord un taux')
  })

  it('activer envoie l\'interrupteur et le taux par défaut, puis recharge la boutique', async () => {
    const { renderer, onSaved } = await render({ defaultTaxCategoryId: 'tax-standard' })

    await act(async () => renderer.root.findAllByType(Switch)[0].props.onValueChange(true))
    await flush()

    expect(api.configure).toHaveBeenCalledWith(true, 'tax-standard')
    expect(onSaved).toHaveBeenCalled()
  })

  it('désactiver ne perd pas le taux par défaut (le serveur le conserve)', async () => {
    const { renderer } = await render({ taxEnabled: true, defaultTaxCategoryId: 'tax-standard' })

    await act(async () => renderer.root.findAllByType(Switch)[0].props.onValueChange(false))
    await flush()

    expect(api.configure).toHaveBeenCalledWith(false, 'tax-standard')
  })

  it('ajouter un taux crée la catégorie fiscale avec son pourcentage', async () => {
    const { renderer } = await render({ defaultTaxCategoryId: 'tax-standard' })
    const inputs = renderer.root.findAllByType(TextInput)

    await typeInto(renderer, inputs, 0, 'Taux réduit')
    await typeInto(renderer, inputs, 1, '5,5')
    await press(renderer, 'Ajouter')
    await flush()

    expect(api.create).toHaveBeenCalledWith({ name: 'Taux réduit', ratePercent: 5.5 })
  })

  it('propose les taux officiels du pays et adopte celui qui ne l\'est pas encore', async () => {
    const { renderer, onSaved } = await render({ defaultTaxCategoryId: 'tax-standard' })

    const text = allText(renderer)
    expect(text).toContain('TVA réduite')
    expect(text).toContain('5.5 %')
    expect(text).toContain('Adopté') // le taux normal est déjà adopté

    await press(renderer, 'Adopter')
    await flush()

    expect(api.importCountryRate).toHaveBeenCalledWith('REDUCED')
    expect(onSaved).toHaveBeenCalled()
  })

  it('un taux issu du pays est étiqueté Officiel ou Personnalisé, et un taux personnalisé peut revenir à l\'officiel', async () => {
    api.getActiveCategories.mockResolvedValue([
      { ...STANDARD, officialRateCode: 'STANDARD', followsOfficialRate: false },
      { id: 'tax-reduced', name: 'TVA réduite', active: true, ratePercent: 5.5, officialRateCode: 'REDUCED', followsOfficialRate: true },
    ])
    const { renderer } = await render({ defaultTaxCategoryId: 'tax-standard' })

    const text = allText(renderer)
    expect(text).toContain('Personnalisé')
    expect(text).toContain('Officiel')

    await press(renderer, 'Taux officiel')
    await flush()

    expect(api.followOfficialRate).toHaveBeenCalledWith('tax-standard')
  })

  it('changer le pays de la boutique l\'envoie au serveur', async () => {
    const { renderer, onSaved } = await render({ defaultTaxCategoryId: 'tax-standard' })

    await act(async () => mockSelects[0].onChange('SN'))
    await flush()

    expect(changeCountry).toHaveBeenCalledWith('t1', 'SN')
    expect(onSaved).toHaveBeenCalled()
    void renderer
  })

  it('un refus du serveur est affiché', async () => {
    api.configure.mockRejectedValueOnce(new Error('Une catégorie fiscale par défaut est requise'))
    const { renderer } = await render({ defaultTaxCategoryId: 'tax-standard' })

    await act(async () => renderer.root.findAllByType(Switch)[0].props.onValueChange(true))
    await flush()

    expect(allText(renderer)).toContain('Une catégorie fiscale par défaut est requise')
  })

  it('un membre qui n\'est pas propriétaire ne peut ni activer, ni ajouter, ni modifier un taux', async () => {
    const { renderer } = await render({ isOwner: false, defaultTaxCategoryId: 'tax-standard' })

    expect(allText(renderer)).toContain('Seul le propriétaire de la boutique peut modifier ce réglage.')
    expect(renderer.root.findAllByType(Switch)[0].props.disabled).toBe(true)
    expect(renderer.root.findAllByType(TextInput)).toHaveLength(0)
    expect(renderer.root.findAll((n) => typeof n.props.onPress === 'function' && textOf(n).includes('Modifier'))).toHaveLength(0)
  })
})
