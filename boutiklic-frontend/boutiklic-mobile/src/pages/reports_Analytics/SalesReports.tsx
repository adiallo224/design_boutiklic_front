import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { Download, FileText } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import {
  ReportTooLargeError,
  salesReportsApi,
  type SalesExportJobStatus,
  type SalesReportFormat,
  type SalesReportPeriod,
  type SalesReportQuery,
  type SalesReportResponse,
  type SalesReportType,
} from '../../lib/reportingApi'
import { toErrorMessage } from '../../lib/apiClient'
import { formatDate, formatDateTime } from '../../lib/dateFormat'
import DateField from '../../components/DateField'
import SelectField from '../../components/SelectField'

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

/** Largeur d'une colonne du tableau d'aperçu : la première (libellé/date) est plus large, le tableau défile en travers. */
const FIRST_COLUMN_WIDTH = 150
const COLUMN_WIDTH = 112

/** Écrit le fichier dans le cache puis ouvre la feuille de partage OS (pas de téléchargement navigateur en RN). */
async function shareBytes(fileName: string, bytes: Uint8Array): Promise<void> {
  const file = new File(Paths.cache, fileName)
  if (file.exists) file.delete()
  file.create()
  file.write(bytes)
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri)
  }
}

/**
 * Rapports et exports des ventes : type + période + format, aperçu des chiffres clés et partage du fichier (Excel, PDF, CSV).
 * Réservé au propriétaire (le bilan expose coût et marge). Un rapport trop volumineux pour un envoi immédiat est préparé par le
 * serveur en arrière-plan ; l'écran attend qu'il soit prêt puis ouvre le partage.
 */
export default function SalesReports() {
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
    salesReportsApi.get({ type, period, from: customFrom, to: customTo, language: i18n.language })
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(toErrorMessage(e)) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [type, period, customFrom, customTo, isCustomReady, i18n.language])

  // Le suivi d'un export en arrière-plan s'arrête quand on quitte l'écran
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const fileSuffix = period === 'CUSTOM' ? `${customFrom}_${customTo}` : period.toLowerCase()

  /** Rapport trop gros pour un envoi immédiat : le serveur le prépare, on attend qu'il soit prêt (jusqu'à 10 min). */
  const shareInBackground = async () => {
    setBackgroundStatus('PENDING')
    let job = await salesReportsApi.startJob(query, format)
    for (let attempt = 0; attempt < BACKGROUND_MAX_POLLS && (job.status === 'PENDING' || job.status === 'RUNNING'); attempt++) {
      await new Promise((resolve) => setTimeout(resolve, BACKGROUND_POLL_MS))
      if (!mounted.current) return
      job = await salesReportsApi.getJob(job.id)
      setBackgroundStatus(job.status)
    }
    if (job.status === 'FAILED') throw new Error(job.errorMessage ?? t('reportsAnalytics.salesReportsBackgroundFailed'))
    if (job.status !== 'DONE') throw new Error(t('reportsAnalytics.salesReportsBackgroundTimeout'))
    await shareBytes(job.fileName ?? `ventes-${type.toLowerCase()}-${fileSuffix}.${format}`, await salesReportsApi.downloadJob(job.id))
  }

  /** @param sample true = fichier d'exemple sur données fictives (aucune vente lue). */
  const share = async (sample: boolean) => {
    setExporting(true)
    setError(null)
    try {
      if (sample) {
        await shareBytes(`exemple-ventes-${type.toLowerCase()}-${fileSuffix}.${format}`, await salesReportsApi.exportSample(query, format))
        return
      }
      try {
        await shareBytes(`ventes-${type.toLowerCase()}-${fileSuffix}.${format}`, await salesReportsApi.export(query, format))
      } catch (e) {
        if (!(e instanceof ReportTooLargeError)) throw e
        await shareInBackground()
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBackgroundStatus(null)
      setExporting(false)
    }
  }

  const periods: { value: SalesReportPeriod; label: string }[] = [
    { value: 'DAY', label: t('reportsAnalytics.salesReportsPeriodDay') },
    { value: 'WEEK', label: t('reportsAnalytics.salesReportsPeriodWeek') },
    { value: 'MONTH', label: t('reportsAnalytics.salesReportsPeriodMonth') },
    { value: 'YEAR', label: t('reportsAnalytics.salesReportsPeriodYear') },
    { value: 'CUSTOM', label: t('reportsAnalytics.salesReportsPeriodCustom') },
  ]

  // Le libellé « Total » de la ligne de pied tombe parfois dans une colonne de date ou de montant : on l'affiche tel quel.
  const formatCell = (value: string | number | null, kind: string): string => {
    if (value === null || value === undefined) return ''
    if (kind === 'TEXT') return String(value)
    if (typeof value === 'string' && (kind === 'DATE' || kind === 'DATE_TIME' ? !/^\d{4}-\d{2}-\d{2}/.test(value) : Number.isNaN(Number(value)))) return value
    if (kind === 'DATE') return formatDate(`${value}T00:00:00`)
    if (kind === 'DATE_TIME') return formatDateTime(String(value), { dateStyle: 'short', timeStyle: 'short' })
    return formatNumber(Number(value), locale)
  }

  const columnWidth = (index: number) => (index === 0 ? FIRST_COLUMN_WIDTH : COLUMN_WIDTH)
  const disabled = exporting || !isCustomReady

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 }}>
      <View className="gap-0.5">
        <Text className="text-[21px] font-extrabold tracking-tight">{t('reportsAnalytics.salesReportsTitle')}</Text>
        <Text className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.salesReportsSubtitle')}</Text>
      </View>

      <View className="gap-2.5">
        <View className="gap-1">
          <Text className="text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.salesReportsType')}</Text>
          <SelectField
            value={type}
            onChange={(v) => setType(v as SalesReportType)}
            options={REPORT_TYPES.map((r) => ({ value: r.id, label: t(`reportsAnalytics.${r.labelKey}`) }))}
          />
        </View>
        <View className="gap-1">
          <Text className="text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.salesReportsPeriod')}</Text>
          <SelectField value={period} onChange={(v) => setPeriod(v as SalesReportPeriod)} options={periods} />
        </View>
        {period === 'CUSTOM' && (
          <View className="flex-row gap-2.5">
            <DateField
              value={customFrom}
              onChange={setCustomFrom}
              placeholder={t('reportsAnalytics.fromPlaceholder')}
              className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
              textClassName="font-semibold"
            />
            <DateField
              value={customTo}
              onChange={setCustomTo}
              placeholder={t('reportsAnalytics.toPlaceholder')}
              className="flex-1 h-[44px] rounded-xl border border-border-strong bg-bg-card px-3 justify-center"
              textClassName="font-semibold"
            />
          </View>
        )}
        <View className="gap-1">
          <Text className="text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.salesReportsFormat')}</Text>
          <View className="flex-row gap-2">
            {FORMATS.map((f) => (
              <Pressable
                key={f.id}
                onPress={() => setFormat(f.id)}
                className={`flex-1 h-[46px] rounded-xl items-center justify-center ${format === f.id ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
              >
                <Text className={`text-sm ${format === f.id ? 'text-primary font-extrabold' : 'text-[#5C5147] font-bold'}`}>{f.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View className="rounded-[20px] bg-bg-card border border-border p-4 gap-3">
        {backgroundStatus && (
          <Text className="text-xs font-semibold text-info-text">{t(`reportsAnalytics.salesReportsBackground_${backgroundStatus}`)}</Text>
        )}
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        {!isCustomReady ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.salesReportsPickDates')}</Text>
        ) : isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : report ? (
          <>
            <Text className="text-xs font-semibold text-text-dim">{report.shopName} · {report.subtitle} · {report.currency}</Text>

            {report.indicators.length > 0 && (
              <View className="flex-row flex-wrap gap-2.5">
                {report.indicators.map((indicator) => (
                  <View key={indicator.label} className="bg-bg p-3 rounded-xl" style={{ width: '48%' }}>
                    <Text className="text-[11px] font-semibold text-text-muted" numberOfLines={2}>{indicator.label}</Text>
                    <Text className="amount text-lg font-extrabold text-primary">{formatCell(indicator.value, indicator.type)}</Text>
                  </View>
                ))}
              </View>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View>
                <View className="flex-row pb-1.5">
                  {report.columns.map((c, i) => (
                    <Text
                      key={c.label}
                      style={{ width: columnWidth(i) }}
                      className={`text-[10px] font-extrabold uppercase text-text-dim ${i === 0 ? '' : 'text-right pl-2'}`}
                    >
                      {c.label}
                    </Text>
                  ))}
                </View>
                {report.rows.map((row, r) => (
                  <View key={r} className="flex-row py-2 border-t border-border-hairline">
                    {row.map((cell, i) => (
                      <Text
                        key={i}
                        style={{ width: columnWidth(i) }}
                        className={i === 0 ? 'text-[13px] font-bold' : 'amount text-[13px] text-text-secondary text-right pl-2'}
                      >
                        {formatCell(cell, report.columns[i].type)}
                      </Text>
                    ))}
                  </View>
                ))}
                {report.totals && (
                  <View className="flex-row pt-2 border-t-2 border-border">
                    {report.totals.map((cell, i) => (
                      <Text
                        key={i}
                        style={{ width: columnWidth(i) }}
                        className={`text-[13px] font-extrabold text-primary ${i === 0 ? '' : 'amount text-right pl-2'}`}
                      >
                        {formatCell(cell, report.columns[i].type)}
                      </Text>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
          </>
        ) : null}

        <Text className="text-[11px] leading-snug text-text-muted">{t('reportsAnalytics.salesReportsHelp')}</Text>
      </View>

      <View className="flex-row gap-2.5">
        <Pressable
          onPress={() => share(true)}
          disabled={disabled}
          className="flex-1 flex-row items-center justify-center gap-2 h-[50px] rounded-2xl bg-bg-card border border-border-strong disabled:opacity-40"
        >
          <FileText size={16} color="#5C5147" />
          <Text className="text-[13px] font-bold text-[#5C5147]" numberOfLines={1}>{t('reportsAnalytics.salesReportsSample')}</Text>
        </Pressable>
        <Pressable
          onPress={() => share(false)}
          disabled={disabled || isLoading || !report}
          className="flex-1 flex-row items-center justify-center gap-2 h-[50px] rounded-2xl bg-primary disabled:opacity-40"
        >
          <Download size={17} color="#FFFDFA" />
          <Text className="text-papier font-extrabold">{exporting ? '...' : t('reportsAnalytics.salesReportsDownload')}</Text>
        </Pressable>
      </View>
    </ScrollView>
  )
}
