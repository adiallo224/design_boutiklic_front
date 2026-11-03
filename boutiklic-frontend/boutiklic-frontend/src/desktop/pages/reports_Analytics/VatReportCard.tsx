import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Download } from 'lucide-react'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { reportingApi, type VatReportResponse } from '../../../lib/reportingApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { downloadBlob } from '../../../lib/downloadFile'
import { formatTaxRate } from '../../../lib/taxInheritance'
import { useTenant } from '../../../hooks/useTenant'

interface VatReportCardProps {
  /** Période choisie sur l'écran Statistiques (AAAA-MM-JJ, bornes incluses). */
  from: string
  to: string
}

/**
 * TVA collectée par taux sur la période de l'écran Statistiques — la base d'une déclaration : base HT, TVA et total TTC pour chaque
 * taux, NETS des retours et des rabais. Réservé au propriétaire (chiffres financiers). Export CSV pour le comptable.
 */
export default function VatReportCard({ from, to }: VatReportCardProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [report, setReport] = useState<VatReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)
    reportingApi.getVatReport(from, to)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(toErrorMessage(e)) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [from, to])

  const exportCsv = async () => {
    setExporting(true)
    setError(null)
    try {
      await downloadBlob(await reportingApi.exportVatCsv(from, to, i18n.language), `tva-${from}_${to}.csv`)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const amount = (value: number) => formatNumber(value, locale)

  return (
    <div className="bg-bg-card p-4 sm:p-5 rounded-2xl border border-border flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col min-w-0">
          <h3 className="text-base font-extrabold text-primary">{t('reportsAnalytics.vatTitle')}</h3>
          <p className="text-xs font-semibold text-text-dim">{t('reportsAnalytics.vatSubtitle')}</p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={exporting || isLoading || !report || (report.lines.length === 0 && report.deductibleTax === 0)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-[10px] border border-border bg-bg-card text-xs font-bold text-info-text hover:bg-bg-elevated disabled:opacity-40"
        >
          <Download size={14} />
          {t('reportsAnalytics.vatExport')}
        </button>
      </div>

      {error && <div className="text-xs font-semibold text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : !report || (report.lines.length === 0 && report.deductibleTax === 0) ? (
        <div className="text-sm font-semibold text-text-dim">{t('reportsAnalytics.vatEmpty')}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-extrabold uppercase text-text-dim">
                <th className="text-left font-extrabold pb-2">{t('reportsAnalytics.vatRateColumn')}</th>
                <th className="text-right font-extrabold pb-2">{t('reportsAnalytics.vatHtColumn')}</th>
                <th className="text-right font-extrabold pb-2">{t('reportsAnalytics.vatTaxColumn')}</th>
                <th className="text-right font-extrabold pb-2">{t('reportsAnalytics.vatTtcColumn')}</th>
              </tr>
            </thead>
            <tbody>
              {report.lines.map((line) => (
                <tr key={line.exempt ? 'exempt' : (line.ratePercent ?? 'none')} className="border-t border-border-hairline">
                  <td className="py-2 font-bold text-text">{line.exempt ? t('reportsAnalytics.vatExempt') : line.ratePercent === null ? t('reportsAnalytics.vatNoVat') : `${formatTaxRate(line.ratePercent)} %`}</td>
                  <td className="amount py-2 text-right text-text-secondary">{amount(line.totalHt)}</td>
                  <td className="amount py-2 text-right font-bold text-text">{amount(line.totalTax)}</td>
                  <td className="amount py-2 text-right text-text-secondary">{amount(line.totalTtc)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border">
                <td className="pt-2 font-extrabold text-primary">{t('reportsAnalytics.vatTotal')}</td>
                <td className="amount pt-2 text-right font-extrabold text-primary">{amount(report.totalHt)}</td>
                <td className="amount pt-2 text-right font-extrabold text-primary">{amount(report.totalTax)}</td>
                <td className="amount pt-2 text-right font-extrabold text-primary">{amount(report.totalTtc)}</td>
              </tr>
            </tfoot>
          </table>
          <div className="text-[11px] font-semibold text-text-dim mt-1.5">{tenant.currency}</div>

          <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-text-muted">{t('reportsAnalytics.vatTitle')}</span>
              <span className="amount font-bold text-text">{amount(report.totalTax)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="font-semibold text-text-muted">{t('reportsAnalytics.vatDeductible')}</span>
              <span className="amount font-bold text-text">− {amount(report.deductibleTax)}</span>
            </div>
            <div className="flex justify-between gap-3 pt-1.5 border-t border-border-hairline">
              <span className="font-extrabold text-primary">{report.netTaxPayable < 0 ? t('reportsAnalytics.vatCredit') : t('reportsAnalytics.vatPayable')}</span>
              <span className="amount font-extrabold text-primary">{amount(Math.abs(report.netTaxPayable))}</span>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-text-muted leading-relaxed">{t('reportsAnalytics.vatHelp')}</p>
    </div>
  )
}
