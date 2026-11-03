import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, FileText } from 'lucide-react'
import { formatDate, formatDateTime, formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import {
  ReportTooLargeError,
  reportingApi,
  salesExportJobsApi,
  type SalesExportJobStatus,
  type SalesReportFormat,
  type SalesReportPeriod,
  type SalesReportQuery,
  type SalesReportResponse,
  type SalesReportType,
} from '../../../lib/reportingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'

/** Suivi d'un export en arrière-plan : une interrogation toutes les 2 s, 10 minutes au plus. */
const BACKGROUND_POLL_MS = 2000
const BACKGROUND_MAX_POLLS = 300

const REPORT_TYPES: { id: SalesReportType; labelKey: string }[] = [
  { id: 'SUMMARY', labelKey: 'salesReportsTypeSummary' },
  { id: 'DAILY', labelKey: 'salesReportsTypeDaily' },
  { id: 'PRODUCT', labelKey: 'salesReportsTypeProduct' },
  { id: 'CATEGORY', labelKey: 'salesReportsTypeCategory' },
  { id: 'MARGIN', labelKey: 'salesReportsTypeMargin' },
  { id: 'TOP_PRODUCTS', labelKey: 'salesReportsTypeTop' },
  { id: 'DETAIL', labelKey: 'salesReportsTypeDetail' },
  { id: 'PAYMENT', labelKey: 'salesReportsTypePayment' },
  { id: 'CREDIT', labelKey: 'salesReportsTypeCredit' },
  { id: 'DISCOUNT', labelKey: 'salesReportsTypeDiscount' },
  { id: 'RETURN', labelKey: 'salesReportsTypeReturn' },
  { id: 'SELLER', labelKey: 'salesReportsTypeSeller' },
  { id: 'VAT', labelKey: 'salesReportsTypeVat' },
  { id: 'DEPOT', labelKey: 'salesReportsTypeDepot' },
  { id: 'CASH', labelKey: 'salesReportsTypeCash' },
]

const FORMATS: { id: SalesReportFormat; label: string }[] = [
  { id: 'xlsx', label: 'Excel' },
  { id: 'pdf', label: 'PDF' },
  { id: 'csv', label: 'CSV' },
]

/**
 * Rapports et exports des ventes : type + période + format, aperçu des chiffres clés et téléchargement (Excel, PDF, CSV).
 * Réservé au propriétaire (le bilan expose coût et marge). Le choix de période est propre à ce bloc : on exporte souvent une
 * autre période que celle affichée plus haut dans Statistiques.
 */
export default function SalesReportsCard() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [type, setType] = useState<SalesReportType>('SUMMARY')
  const [period, setPeriod] = useState<SalesReportPeriod>('MONTH')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [format, setFormat] = useState<SalesReportFormat>('xlsx')
  const [report, setReport] = useState<SalesReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [backgroundStatus, setBackgroundStatus] = useState<SalesExportJobStatus | null>(null)

  const isCustomReady = period !== 'CUSTOM' || (customFrom !== '' && customTo !== '' && customFrom <= customTo)
  const query: SalesReportQuery = { type, period, from: customFrom, to: customTo, language: i18n.language }

  useEffect(() => {
    if (!isCustomReady) {
      setReport(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    reportingApi.getSalesReport({ type, period, from: customFrom, to: customTo, language: i18n.language })
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(toErrorMessage(e)) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [type, period, customFrom, customTo, isCustomReady, i18n.language])

  // Le suivi d'un export en arrière-plan s'arrête quand on quitte l'écran
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  /** Rapport trop gros pour un téléchargement immédiat : le serveur le prépare, on attend qu'il soit prêt (jusqu'à 10 min). */
  const downloadInBackground = async (fileSuffix: string) => {
    setBackgroundStatus('PENDING')
    let job = await salesExportJobsApi.start(query, format)
    for (let attempt = 0; attempt < BACKGROUND_MAX_POLLS && (job.status === 'PENDING' || job.status === 'RUNNING'); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, BACKGROUND_POLL_MS))
      if (!mounted.current) return
      job = await salesExportJobsApi.get(job.id)
      setBackgroundStatus(job.status)
    }
    if (job.status === 'FAILED') throw new Error(job.errorMessage ?? t('reportsAnalytics.salesReportsBackgroundFailed'))
    if (job.status !== 'DONE') throw new Error(t('reportsAnalytics.salesReportsBackgroundTimeout'))
    await downloadBlob(await salesExportJobsApi.download(job.id), job.fileName ?? `ventes-${type.toLowerCase()}-${fileSuffix}.${format}`)
  }

  /** @param sample true = fichier d'exemple sur données fictives (aucune vente lue). */
  const download = async (sample: boolean) => {
    setExporting(true)
    setError(null)
    const suffix = period === 'CUSTOM' ? `${customFrom}_${customTo}` : period.toLowerCase()
    try {
      if (sample) {
        await downloadBlob(await reportingApi.exportSalesSample(query, format), `exemple-ventes-${type.toLowerCase()}-${suffix}.${format}`)
        return
      }
      try {
        await downloadBlob(await reportingApi.exportSalesReport(query, format), `ventes-${type.toLowerCase()}-${suffix}.${format}`)
      } catch (e) {
        if (!(e instanceof ReportTooLargeError)) throw e
        await downloadInBackground(suffix)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBackgroundStatus(null)
      setExporting(false)
    }
  }

  const periods: { id: SalesReportPeriod; label: string }[] = [
    { id: 'DAY', label: t('reportsAnalytics.salesReportsPeriodDay') },
    { id: 'WEEK', label: t('reportsAnalytics.salesReportsPeriodWeek') },
    { id: 'MONTH', label: t('reportsAnalytics.salesReportsPeriodMonth') },
    { id: 'YEAR', label: t('reportsAnalytics.salesReportsPeriodYear') },
    { id: 'CUSTOM', label: t('reportsAnalytics.salesReportsPeriodCustom') },
  ]

  // Le libellé « Total » de la ligne de pied tombe parfois dans une colonne de date ou de montant : on l'affiche tel quel.
  const formatCell = (value: string | number | null, kind: string) => {
    if (value === null || value === undefined) return ''
    if (kind === 'TEXT') return String(value)
    if (typeof value === 'string' && (kind === 'DATE' || kind === 'DATE_TIME' ? !/^\d{4}-\d{2}-\d{2}/.test(value) : Number.isNaN(Number(value)))) return value
    if (kind === 'DATE') return formatDate(`${value}T00:00:00`, locale)
    if (kind === 'DATE_TIME') return formatDateTime(String(value), locale)
    return formatNumber(Number(value), locale)
  }

  const selectClass = 'w-full px-3 py-2 rounded-[10px] border border-border bg-bg-card text-sm font-semibold text-text'
  const labelClass = 'text-[10px] font-extrabold uppercase text-text-dim'

  return (
    <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
      <div className="flex flex-col">
        <h3 className="text-base font-extrabold text-primary">{t('reportsAnalytics.salesReportsTitle')}</h3>
        <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.salesReportsSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('reportsAnalytics.salesReportsType')}</span>
          <select className={selectClass} value={type} onChange={(e) => setType(e.target.value as SalesReportType)}>
            {REPORT_TYPES.map((r) => <option key={r.id} value={r.id}>{t(`reportsAnalytics.${r.labelKey}`)}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('reportsAnalytics.salesReportsPeriod')}</span>
          <select className={selectClass} value={period} onChange={(e) => setPeriod(e.target.value as SalesReportPeriod)}>
            {periods.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>{t('reportsAnalytics.salesReportsFormat')}</span>
          <select className={selectClass} value={format} onChange={(e) => setFormat(e.target.value as SalesReportFormat)}>
            {FORMATS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </label>
      </div>

      {period === 'CUSTOM' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('reportsAnalytics.salesReportsFrom')}</span>
            <input type="date" className={selectClass} value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>{t('reportsAnalytics.salesReportsTo')}</span>
            <input type="date" className={selectClass} value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} />
          </label>
        </div>
      )}

      {backgroundStatus && <div className="text-xs font-semibold text-info-text">{t(`reportsAnalytics.salesReportsBackground_${backgroundStatus}`)}</div>}
      {error && <div className="text-xs font-semibold text-danger">{error}</div>}

      {!isCustomReady ? (
        <div className="text-sm font-semibold text-text-dim">{t('reportsAnalytics.salesReportsPickDates')}</div>
      ) : isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : report && (
        <>
          <div className="text-xs font-semibold text-text-dim break-words">{report.shopName} · {report.subtitle} · {report.currency}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {report.indicators.map((indicator) => (
              <div key={indicator.label} className="min-w-0 bg-bg p-3 rounded-xl flex flex-col">
                <span className="text-[11px] font-semibold text-text-muted break-words">{indicator.label}</span>
                <span className="amount text-base sm:text-lg font-extrabold text-primary break-all">{formatCell(indicator.value, indicator.type)}</span>
              </div>
            ))}
          </div>
          <div className="overflow-x-auto -mx-1 px-1"><table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className={labelClass}>
                {report.columns.map((c, i) => (
                  <th key={c.label} className={`${i === 0 ? 'text-left' : 'text-right'} font-extrabold pb-2 pl-3 first:pl-0`}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, r) => (
                <tr key={r} className="border-t border-border-hairline">
                  {row.map((cell, i) => (
                    <td key={i} className={i === 0 ? 'py-2 font-bold text-text' : 'amount py-2 pl-3 text-right text-text-secondary whitespace-nowrap'}>
                      {formatCell(cell, report.columns[i].type)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {report.totals && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  {report.totals.map((cell, i) => (
                    <td key={i} className="amount pt-2 pl-3 first:pl-0 text-right font-extrabold text-primary first:text-left whitespace-nowrap">{formatCell(cell, report.columns[i].type)}</td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table></div>
        </>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted leading-relaxed">{t('reportsAnalytics.salesReportsHelp')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => download(true)}
            disabled={exporting || !isCustomReady}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-border bg-bg-card text-xs font-bold text-text-secondary hover:bg-bg-elevated disabled:opacity-40"
          >
            <FileText size={14} />
            {t('reportsAnalytics.salesReportsSample')}
          </button>
          <button
            type="button"
            onClick={() => download(false)}
            disabled={exporting || isLoading || !isCustomReady || !report}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-border bg-bg-card text-xs font-bold text-info-text hover:bg-bg-elevated disabled:opacity-40"
          >
            <Download size={14} />
            {t('reportsAnalytics.salesReportsDownload')}
          </button>
        </div>
      </div>
    </div>
  )
}
