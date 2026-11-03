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
jest.mock('../../lib/reportingApi', () => {
  class ReportTooLargeError extends Error {
    maxRows: number
    constructor(message: string, maxRows: number) {
      super(message)
      this.maxRows = maxRows
    }
  }
  return {
    ReportTooLargeError,
    salesReportsApi: { get: jest.fn(), export: jest.fn(), exportSample: jest.fn(), startJob: jest.fn(), getJob: jest.fn(), downloadJob: jest.fn() },
  }
})
// Le sélecteur de date natif et le menu déroulant (Modal + mesure d'écran) ne sont pas l'objet du test.
jest.mock('../../components/DateField', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/SelectField', () => ({ __esModule: true, default: () => null }))
// Écriture sur disque et partage OS : modules natifs, remplacés par des doublures.
const mockWritten: { name: string; bytes: Uint8Array }[] = []
const mockShare = jest.fn()
jest.mock('expo-file-system', () => {
  class File {
    uri: string
    exists = false
    dir: string
    name: string
    constructor(dir: string, name: string) {
      this.dir = dir
      this.name = name
      this.uri = `file:///${dir}/${name}`
    }
    delete() {}
    create() {}
    write(bytes: Uint8Array) {
      mockWritten.push({ name: this.name, bytes })
    }
  }
  return { File, Paths: { cache: 'cache' } }
})
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => true, shareAsync: (...args: unknown[]) => mockShare(...args) }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ReportTooLargeError, salesReportsApi } from '../../lib/reportingApi'
import { allText, flush, press, textOf } from '../../testing/renderHelpers'
import SalesReports from './SalesReports'

const api = salesReportsApi as unknown as Record<'get' | 'export' | 'exportSample' | 'startJob' | 'getJob' | 'downloadJob', jest.Mock>
const mounted: ReactTestRenderer[] = []

const REPORT = {
  title: 'BOUTIKLIC — Bilan des ventes',
  subtitle: 'Période : 2026-10-01 – 2026-10-31',
  shopName: 'Chez Fatou',
  currency: 'GNF',
  amountDecimals: 0,
  indicators: [
    { label: "Chiffre d'affaires net TTC", type: 'AMOUNT', value: 45800000 },
    { label: 'Ventes réalisées', type: 'INTEGER', value: 320 },
  ],
  columns: [
    { label: 'Date', type: 'DATE' },
    { label: 'CA net TTC', type: 'AMOUNT' },
  ],
  rows: [['2026-10-05', 1500000]],
  totals: ['Total', 1500000],
}

async function render() {
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<SalesReports />)
  })
  mounted.push(renderer)
  await flush()
  return renderer
}

beforeEach(() => {
  mockWritten.length = 0
  mockShare.mockReset().mockResolvedValue(undefined)
  api.get.mockReset().mockResolvedValue(REPORT)
  api.export.mockReset().mockResolvedValue(new Uint8Array([1, 2, 3]))
  api.exportSample.mockReset().mockResolvedValue(new Uint8Array([9]))
  api.startJob.mockReset()
  api.getJob.mockReset()
  api.downloadJob.mockReset()
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('rapports et exports des ventes (mobile)', () => {
  it('charge le bilan du mois en cours et affiche chiffres clés, tableau et ligne de totaux', async () => {
    const renderer = await render()

    expect(api.get).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY', period: 'MONTH', language: 'fr' }))
    const text = allText(renderer)
    expect(text).toContain('Rapports et exports des ventes')
    expect(text).toContain('Chez Fatou')
    expect(text.replace(/\s/g, '')).toContain('45800000')
    expect(text).toContain('Ventes réalisées')
    expect(text).toContain('05/10/2026') // une date ISO est affichée à la française
    expect(text).toContain('Total') // le libellé du pied de tableau ne devient pas « Invalid Date »
    expect(text).not.toContain('Invalid')
  })

  it('télécharger écrit le fichier dans le cache puis ouvre le partage', async () => {
    const renderer = await render()

    await press(renderer, 'Télécharger')
    await flush()

    expect(api.export).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY', period: 'MONTH' }), 'xlsx')
    expect(mockWritten).toHaveLength(1)
    expect(mockWritten[0].name).toBe('ventes-summary-month.xlsx')
    expect(Array.from(mockWritten[0].bytes)).toEqual([1, 2, 3])
    expect(mockShare).toHaveBeenCalledWith('file:///cache/ventes-summary-month.xlsx')
  })

  it("l'export d'exemple demande le fichier fictif et le nomme « exemple- »", async () => {
    const renderer = await render()

    await press(renderer, "Préparer un export d'exemple")
    await flush()

    expect(api.exportSample).toHaveBeenCalled()
    expect(api.export).not.toHaveBeenCalled()
    expect(mockWritten[0].name).toBe('exemple-ventes-summary-month.xlsx')
    expect(mockShare).toHaveBeenCalled()
  })

  it("un rapport trop volumineux passe par un export en arrière-plan, puis s'ouvre dans le partage", async () => {
    api.export.mockRejectedValue(new ReportTooLargeError('Trop de lignes', 20000))
    api.startJob.mockResolvedValue({ id: 'job-1', status: 'DONE', fileName: 'ventes-detail-2026.xlsx' })
    api.downloadJob.mockResolvedValue(new Uint8Array([7, 7]))
    const renderer = await render()

    await press(renderer, 'Télécharger')
    await flush()

    expect(api.startJob).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY' }), 'xlsx')
    expect(api.downloadJob).toHaveBeenCalledWith('job-1')
    expect(mockWritten[0].name).toBe('ventes-detail-2026.xlsx')
    expect(mockShare).toHaveBeenCalledWith('file:///cache/ventes-detail-2026.xlsx')
  })

  it("un export en arrière-plan qui échoue affiche son motif, sans partage", async () => {
    api.export.mockRejectedValue(new ReportTooLargeError('Trop de lignes', 20000))
    api.startJob.mockResolvedValue({ id: 'job-2', status: 'FAILED', fileName: null, errorMessage: 'Trop de lignes (maximum 100000)' })
    const renderer = await render()

    await press(renderer, 'Télécharger')
    await flush()

    expect(allText(renderer)).toContain('Trop de lignes (maximum 100000)')
    expect(api.downloadJob).not.toHaveBeenCalled()
    expect(mockShare).not.toHaveBeenCalled()
  })

  it("une autre erreur d'export (permission, réseau) est affichée sans tenter l'arrière-plan", async () => {
    api.export.mockRejectedValue(new Error('Accès refusé'))
    const renderer = await render()

    await press(renderer, 'Télécharger')
    await flush()

    expect(allText(renderer)).toContain('Accès refusé')
    expect(api.startJob).not.toHaveBeenCalled()
    expect(mockShare).not.toHaveBeenCalled()
  })

  it("un refus du serveur à l'aperçu est affiché et bloque le téléchargement", async () => {
    api.get.mockRejectedValue(new Error('Accès refusé'))
    const renderer = await render()

    expect(allText(renderer)).toContain('Accès refusé')
    const download = renderer.root.findAll((n) => typeof n.props.onPress === 'function' && n.props.disabled === true && textOf(n).includes('Télécharger'))
    expect(download.length).toBeGreaterThan(0)
  })
})
