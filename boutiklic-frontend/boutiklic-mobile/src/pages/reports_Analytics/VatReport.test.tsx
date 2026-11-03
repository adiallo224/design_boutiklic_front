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
jest.mock('../../lib/reportingApi', () => ({ reportingApi: { getVatReport: jest.fn() } }))
jest.mock('../../lib/session', () => ({ getAccessToken: async () => 'tok', getActiveTenantId: async () => 't1' }))
jest.mock('../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { name: 'Chez Fatou', currency: 'GNF' } }) }))
// Le sélecteur de date natif n'est pas l'objet du test.
jest.mock('../../components/DateField', () => ({ __esModule: true, default: () => null }))
// Écriture sur disque et partage OS : modules natifs, remplacés par des doublures.
const mockDownload = jest.fn()
const mockShare = jest.fn()
jest.mock('expo-file-system', () => {
  function File() {}
  File.downloadFileAsync = (...args: unknown[]) => mockDownload(...args)
  return { File, Paths: { cache: 'cache' } }
})
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...args: unknown[]) => mockShare(...args) }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { reportingApi } from '../../lib/reportingApi'
import { allText, flush, press } from '../../testing/renderHelpers'
import VatReport, { vatRangeFor } from './VatReport'

const getVatReport = reportingApi.getVatReport as jest.Mock
const mounted: ReactTestRenderer[] = []

const REPORT = {
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  lines: [
    { ratePercent: 5.5, totalHt: 10000, totalTax: 550, totalTtc: 10550, exempt: false },
    { ratePercent: 18, totalHt: 166271, totalTax: 29929, totalTtc: 196200, exempt: false },
    { ratePercent: null, totalHt: 5000, totalTax: 0, totalTtc: 5000, exempt: false },
    { ratePercent: null, totalHt: 40000, totalTax: 0, totalTtc: 40000, exempt: true },
  ],
  totalHt: 221271,
  totalTax: 30479,
  totalTtc: 251750,
  deductibleTax: 5400,
  netTaxPayable: 25079,
}

async function render() {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<VatReport />)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}

beforeEach(() => {
  getVatReport.mockReset().mockResolvedValue(REPORT)
  mockDownload.mockReset().mockResolvedValue({ uri: 'file:///cache/tva.csv' })
  mockShare.mockReset().mockResolvedValue(undefined)
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('périodes du rapport de TVA', () => {
  const NOW = new Date(2026, 9, 24) // 24 octobre 2026

  it('jour, mois et année couvrent leurs bornes complètes', () => {
    expect(vatRangeFor('day', '', '', NOW)).toEqual({ from: '2026-10-24', to: '2026-10-24' })
    expect(vatRangeFor('month', '', '', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(vatRangeFor('year', '', '', NOW)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
  })

  it('février d\'une année bissextile et mois de 30 jours', () => {
    expect(vatRangeFor('month', '', '', new Date(2028, 1, 10))).toEqual({ from: '2028-02-01', to: '2028-02-29' })
    expect(vatRangeFor('month', '', '', new Date(2026, 3, 10))).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('une période personnalisée incomplète n\'a pas de bornes', () => {
    expect(vatRangeFor('custom', '2026-10-01', '', NOW)).toBeNull()
    expect(vatRangeFor('custom', '2026-10-01', '2026-10-15', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-15' })
  })
})

describe('rapport de TVA collectée (mobile)', () => {
  it('charge le mois en cours et affiche chaque taux, les ventes sans TVA et le total', async () => {
    const renderer = await render()

    const { from, to } = vatRangeFor('month', '', '')!
    expect(getVatReport).toHaveBeenCalledWith(from, to)
    const text = allText(renderer)
    expect(text).toContain('TVA collectée')
    expect(text).toContain('5.5 %')
    expect(text).toContain('18 %')
    expect(text).toContain('Sans TVA')
    expect(text).toContain('Exonérées') // ventes de clients exonérés : une ligne à part, distincte de « Sans TVA »
    expect(text).toContain('Total')
    expect(text).toContain('GNF')
    expect(text.replace(/\s/g, '')).toContain('30479') // TVA totale, quel que soit l'espace de milliers
  })

  it('affiche la TVA collectée, la TVA déductible des achats et la TVA à payer', async () => {
    const renderer = await render()

    const text = allText(renderer).replace(/\s/g, '')
    expect(text).toContain('TVAdéductible(achats)')
    expect(text).toContain('−5400')
    expect(text).toContain('TVAàpayer')
    expect(text).toContain('25079')
  })

  it('un crédit de TVA (plus de TVA déductible que collectée) est présenté comme tel, en montant positif', async () => {
    getVatReport.mockResolvedValue({ ...REPORT, deductibleTax: 40000, netTaxPayable: -9521 })
    const renderer = await render()

    const text = allText(renderer).replace(/\s/g, '')
    expect(text).toContain('CréditdeTVA')
    expect(text).toContain('9521')
    expect(text).not.toContain('-9521')
  })

  it('une période sans vente mais avec des achats à TVA reste affichée (crédit de TVA), pas « aucune vente »', async () => {
    getVatReport.mockResolvedValue({ ...REPORT, lines: [], totalHt: 0, totalTax: 0, totalTtc: 0, deductibleTax: 5400, netTaxPayable: -5400 })
    const renderer = await render()

    expect(allText(renderer)).not.toContain('Aucune vente sur cette période.')
    expect(allText(renderer).replace(/\s/g, '')).toContain('CréditdeTVA')
  })

  it('changer de période relit le rapport', async () => {
    const renderer = await render()

    await press(renderer, 'Année')
    await flush()

    const { from, to } = vatRangeFor('year', '', '')!
    expect(getVatReport).toHaveBeenLastCalledWith(from, to)
  })

  it('sans vente sur la période : message vide et export bloqué', async () => {
    getVatReport.mockResolvedValue({ ...REPORT, lines: [], totalHt: 0, totalTax: 0, totalTtc: 0, deductibleTax: 0, netTaxPayable: 0 })
    const renderer = await render()

    expect(allText(renderer)).toContain('Aucune vente sur cette période.')
    const exportButton = renderer.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.disabled === true && allTextOf(n).includes('Exporter en CSV'))
    expect(exportButton.length).toBeGreaterThan(0)
  })

  it('un refus du serveur est affiché', async () => {
    getVatReport.mockRejectedValue(new Error('Accès refusé'))
    const renderer = await render()

    expect(allText(renderer)).toContain('Accès refusé')
  })

  it('exporter télécharge le CSV de la période avec la langue et l\'identité de la boutique, puis ouvre le partage', async () => {
    const renderer = await render()

    await press(renderer, 'Exporter en CSV')
    await flush()

    const { from, to } = vatRangeFor('month', '', '')!
    const [url, , options] = mockDownload.mock.calls[0]
    expect(url).toContain(`/reports/vat/export?from=${from}&to=${to}&lang=fr`)
    expect(options.headers).toEqual({ Authorization: 'Bearer tok', 'X-Tenant-ID': 't1' })
    expect(mockShare).toHaveBeenCalledWith('file:///cache/tva.csv')
  })

  it('un échec du téléchargement est affiché, sans ouvrir le partage', async () => {
    mockDownload.mockRejectedValue(new Error('Export échoué (403)'))
    const renderer = await render()

    await press(renderer, 'Exporter en CSV')
    await flush()

    expect(allText(renderer)).toContain('Export échoué (403)')
    expect(mockShare).not.toHaveBeenCalled()
  })
})

function allTextOf(node: { children: unknown[] }): string {
  return node.children.map((c) => (typeof c === 'string' ? c : allTextOf(c as { children: unknown[] }))).join('')
}
