import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CalendarRange, Download } from 'lucide-react'
import { formatNumber, formatDate, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { reportingApi, type BilanPeriod, type ExportFormat, type BilanResponse } from '../../../lib/reportingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import Button from '../../components/Button'
import { useTopBar } from '../../hooks/useTopBar'

type PeriodMode = BilanPeriod | 'custom'

/** W39 — période + format à gauche, aperçu paginé du bilan à droite (règle de traduction n°7 : pas
 *  de bouton "Export" isolé, un vrai écran dédié). Même contrat que ExportReport.tsx (mobile) :
 *  reportingApi.export ne prend que période+format, aucun paramètre de contenu à cocher côté
 *  backend (BilanController) — pas de cases "ventes/stock/dettes" ici, elles ne filtreraient rien
 *  de réel. WhatsApp reste désactivé comme sur mobile (aucun canal branché, cf. study/todo.md #12,
 *  "Web pas encore fait" — écart assumé, pas oublié). */
export default function DesktopExportReport() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()

  useTopBar({ title: t('reportsAnalytics.sendReportTitle') }, [t])

  const [mode, setMode] = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [format, setFormat] = useState<ExportFormat>('pdf')
  const [bilan, setBilan] = useState<BilanResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const periods: { id: BilanPeriod; label: string }[] = [
    { id: 'day', label: t('reportsAnalytics.periodDay') },
    { id: 'month', label: t('reportsAnalytics.periodMonth') },
    { id: 'year', label: t('reportsAnalytics.periodYear') },
  ]

  const isCustomReady = customFrom !== '' && customTo !== ''

  useEffect(() => {
    if (mode === 'custom' && !isCustomReady) {
      setBilan(null)
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    const request = mode === 'custom' ? reportingApi.getBilanRange(customFrom, customTo) : reportingApi.getBilan(mode)
    request.then(setBilan).catch((e) => setError(toErrorMessage(e))).finally(() => setIsLoading(false))
  }, [mode, customFrom, customTo])

  const handleExport = async () => {
    if (mode === 'custom' && !isCustomReady) return
    setExporting(true)
    setError(null)
    try {
      const blob = mode === 'custom' ? await reportingApi.exportRange(customFrom, customTo, format) : await reportingApi.export(mode, format)
      const suffix = mode === 'custom' ? `${customFrom}_${customTo}` : mode
      const filename = `bilan-${suffix}.${format === 'image' ? 'png' : format === 'excel' ? 'xlsx' : 'pdf'}`
      await downloadBlob(blob, filename)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const maxDaily = Math.max(...(bilan?.dailyRevenueSeries ?? [1]), 1)

  return (
    <div className="p-4 sm:p-8 grid grid-cols-1 lg:grid-cols-[minmax(0,380px)_1fr] gap-6 lg:gap-8">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.periodSectionTitle')}</div>
          <div className="flex flex-col gap-2">
            {periods.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setMode(p.id)}
                className={`min-h-11 py-1 px-2 rounded-xl text-sm ${mode === p.id ? 'bg-primary text-papier font-extrabold' : 'bg-bg-card border border-border-strong text-text-muted font-semibold'}`}
              >
                {p.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setMode('custom')}
              className={`min-h-11 py-1 px-2 rounded-xl text-sm flex items-center justify-center gap-1.5 ${mode === 'custom' ? 'bg-primary text-papier font-extrabold' : 'bg-bg-card border border-border-strong text-text-muted font-semibold'}`}
            >
              <CalendarRange size={14} />
              {t('reportsAnalytics.periodCustom')}
            </button>
          </div>
          {mode === 'custom' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="h-11 rounded-xl border border-border-strong bg-bg-card px-3 font-semibold outline-none focus:border-primary" />
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="h-11 rounded-xl border border-border-strong bg-bg-card px-3 font-semibold outline-none focus:border-primary" />
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.formatSectionTitle')}</div>
          <div className="flex flex-wrap gap-2.5">
            {(['pdf', 'image', 'excel'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormat(f)}
                className={`flex-1 min-w-[90px] min-h-11 px-2 rounded-xl text-sm ${format === f ? 'border-2 border-primary bg-info-bg text-primary font-extrabold' : 'border border-border-strong bg-bg-card text-text-muted font-bold'}`}
              >
                {f === 'pdf' ? 'PDF' : f === 'image' ? t('reportsAnalytics.formatImage') : 'Excel'}
              </button>
            ))}
          </div>
        </div>

        {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

        <div className="flex flex-col gap-2.5 pt-2">
          <Button onClick={handleExport} disabled={exporting || (mode === 'custom' && !isCustomReady)} loading={exporting} className="h-12">
            <Download size={16} className="inline mr-2" />
            {t('reportsAnalytics.exportTab')}
          </Button>
          <button
            type="button"
            disabled
            title={t('reportsAnalytics.whatsappNotAvailable')}
            className="h-12 rounded-xl bg-success text-papier text-sm font-extrabold flex items-center justify-center gap-2 opacity-50"
          >
            WhatsApp
          </button>
        </div>
      </div>

      <div className="rounded-2xl bg-bg-card border border-border p-4 sm:p-6 flex flex-col gap-4 max-w-[440px] h-fit">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-2 border-primary">
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="font-display text-base font-extrabold">{tenant.name.toUpperCase()}</div>
            <div className="text-xs font-semibold text-text-dim">
              {bilan ? t('reportsAnalytics.reportRange', { from: formatDate(bilan.periodStart, locale), to: formatDate(bilan.periodEnd, locale) }) : t('reportsAnalytics.reportWord')}
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <div className="w-4 h-4 rounded border-[3px] border-papier" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
          </div>
        </div>

        {isLoading ? (
          <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
        ) : bilan ? (
          <>
            <div className="flex flex-col gap-2.5">
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold text-text-muted">{t('reportsAnalytics.revenueLabel')}</span>
                <span className="amount font-extrabold">{formatNumber(bilan.revenue, locale)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold text-text-muted">{t('reportsAnalytics.costOfGoodsLabel')}</span>
                <span className="amount font-extrabold">{formatNumber(bilan.costOfGoodsSold, locale)}</span>
              </div>
              <div className="flex justify-between text-sm pt-2.5 border-t border-dashed border-border-strong">
                <span className="font-extrabold">{t('reportsAnalytics.profitWord')}</span>
                <span className="amount font-extrabold text-succes-text">{formatNumber(bilan.profit, locale)}</span>
              </div>
              <div className="flex justify-between gap-3 text-sm">
                <span className="font-semibold text-text-muted">{t('reportsAnalytics.outstandingDebtsLabel')}</span>
                <span className="amount font-extrabold text-[#8F3B23]">{formatNumber(bilan.outstandingDebt, locale)}</span>
              </div>
            </div>
            {bilan.dailyRevenueSeries.length > 0 && (
              <div className="h-14 flex items-end gap-1.5 pt-1.5">
                {bilan.dailyRevenueSeries.map((v, i) => (
                  <div key={i} className="flex-1 rounded-sm" style={{ height: `${Math.max(4, (v / maxDaily) * 100)}%`, background: i === bilan.dailyRevenueSeries.length - 1 ? '#0E2038' : '#E4EAF2' }} />
                ))}
              </div>
            )}
          </>
        ) : mode === 'custom' ? (
          <div className="text-sm font-semibold text-text-dim text-center py-6">{t('reportsAnalytics.chooseDateRange')}</div>
        ) : null}

        <div className="mt-auto pt-3 border-t border-dashed border-border-strong text-[11px] font-semibold text-text-dim text-center">
          {t('reportsAnalytics.generatedBy', { date: formatDate(new Date(), locale) })}
        </div>
      </div>
    </div>
  )
}
