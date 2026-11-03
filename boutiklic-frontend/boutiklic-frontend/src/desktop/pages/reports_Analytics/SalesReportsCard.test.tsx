// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'

// Les textes : la clé de traduction suffit à reconnaître un bouton ou un message, sans charger l'i18n réel.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}))
vi.mock('../../../lib/apiClient', () => ({ toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }))
vi.mock('../../../lib/downloadFile', () => ({ downloadBlob: vi.fn() }))
vi.mock('../../../lib/reportingApi', () => {
  class ReportTooLargeError extends Error {
    maxRows: number
    constructor(message: string, maxRows: number) {
      super(message)
      this.maxRows = maxRows
    }
  }
  return {
    ReportTooLargeError,
    reportingApi: { getSalesReport: vi.fn(), exportSalesReport: vi.fn(), exportSalesSample: vi.fn() },
    salesExportJobsApi: { start: vi.fn(), get: vi.fn(), download: vi.fn() },
  }
})

import { downloadBlob } from '../../../lib/downloadFile'
import { ReportTooLargeError, reportingApi, salesExportJobsApi } from '../../../lib/reportingApi'
import SalesReportsCard from './SalesReportsCard'

const api = reportingApi as unknown as Record<'getSalesReport' | 'exportSalesReport' | 'exportSalesSample', ReturnType<typeof vi.fn>>
const jobs = salesExportJobsApi as unknown as Record<'start' | 'get' | 'download', ReturnType<typeof vi.fn>>
const download = downloadBlob as unknown as ReturnType<typeof vi.fn>

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

const blob = new Blob(['x'])
const DOWNLOAD = 'reportsAnalytics.salesReportsDownload'
const SAMPLE = 'reportsAnalytics.salesReportsSample'

async function renderLoaded() {
  render(<SalesReportsCard />)
  await screen.findByText(/Chez Fatou/)
}

const flat = (text: string) => text.replace(/\s/g, '')

beforeEach(() => {
  api.getSalesReport.mockReset().mockResolvedValue(REPORT)
  api.exportSalesReport.mockReset().mockResolvedValue(blob)
  api.exportSalesSample.mockReset().mockResolvedValue(blob)
  jobs.start.mockReset()
  jobs.get.mockReset()
  jobs.download.mockReset()
  download.mockReset().mockResolvedValue(undefined)
})

afterEach(cleanup)

describe('rapports et exports des ventes (web desktop)', () => {
  it('charge le bilan du mois en cours et affiche chiffres clés, tableau et ligne de totaux', async () => {
    await renderLoaded()

    expect(api.getSalesReport).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY', period: 'MONTH', language: 'fr' }))
    const text = flat(document.body.textContent ?? '')
    expect(text).toContain('45800000')
    expect(text).toContain('Ventesréalisées')
    expect(text).toContain('05/10/2026') // une date ISO est affichée à la française
    expect(text).toContain('Total') // le libellé du pied de tableau ne devient pas « Invalid Date »
    expect(text).not.toContain('Invalid')
  })

  it('télécharger demande le fichier dans le format choisi et le sauvegarde', async () => {
    await renderLoaded()

    fireEvent.click(screen.getByText(DOWNLOAD))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(api.exportSalesReport).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY', period: 'MONTH' }), 'xlsx')
    expect(download).toHaveBeenCalledWith(blob, 'ventes-summary-month.xlsx')
  })

  it("l'export d'exemple demande le fichier fictif, sans toucher aux vraies ventes", async () => {
    await renderLoaded()

    fireEvent.click(screen.getByText(SAMPLE))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(api.exportSalesSample).toHaveBeenCalled()
    expect(api.exportSalesReport).not.toHaveBeenCalled()
    expect(download).toHaveBeenCalledWith(blob, 'exemple-ventes-summary-month.xlsx')
  })

  it("un rapport trop volumineux passe par un export en arrière-plan, puis se télécharge", async () => {
    api.exportSalesReport.mockRejectedValue(new ReportTooLargeError('Trop de lignes', 20000))
    jobs.start.mockResolvedValue({ id: 'job-1', status: 'DONE', fileName: 'ventes-detail-2026.xlsx', errorMessage: null })
    jobs.download.mockResolvedValue(blob)
    await renderLoaded()

    fireEvent.click(screen.getByText(DOWNLOAD))

    await waitFor(() => expect(download).toHaveBeenCalledTimes(1))
    expect(jobs.start).toHaveBeenCalledWith(expect.objectContaining({ type: 'SUMMARY' }), 'xlsx')
    expect(jobs.download).toHaveBeenCalledWith('job-1')
    expect(download).toHaveBeenCalledWith(blob, 'ventes-detail-2026.xlsx')
  })

  it("un export en arrière-plan qui échoue affiche son motif, sans téléchargement", async () => {
    api.exportSalesReport.mockRejectedValue(new ReportTooLargeError('Trop de lignes', 20000))
    jobs.start.mockResolvedValue({ id: 'job-2', status: 'FAILED', fileName: null, errorMessage: 'Trop de lignes (maximum 100000)' })
    await renderLoaded()

    fireEvent.click(screen.getByText(DOWNLOAD))

    await screen.findByText('Trop de lignes (maximum 100000)')
    expect(jobs.download).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
  })

  it("une autre erreur d'export (permission, réseau) est affichée sans tenter l'arrière-plan", async () => {
    api.exportSalesReport.mockRejectedValue(new Error('Accès refusé'))
    await renderLoaded()

    fireEvent.click(screen.getByText(DOWNLOAD))

    await screen.findByText('Accès refusé')
    expect(jobs.start).not.toHaveBeenCalled()
    expect(download).not.toHaveBeenCalled()
  })

  it("un refus du serveur à l'aperçu est affiché et bloque le téléchargement", async () => {
    api.getSalesReport.mockRejectedValue(new Error('Accès refusé'))
    render(<SalesReportsCard />)

    await screen.findByText('Accès refusé')
    expect((screen.getByText(DOWNLOAD).closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('changer de type relit le rapport demandé', async () => {
    await renderLoaded()

    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'DAILY' } })

    await waitFor(() => expect(api.getSalesReport).toHaveBeenLastCalledWith(expect.objectContaining({ type: 'DAILY' })))
  })
})
