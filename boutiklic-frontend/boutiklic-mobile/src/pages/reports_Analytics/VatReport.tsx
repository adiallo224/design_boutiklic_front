import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { CalendarRange, Download } from 'lucide-react-native'
import { File, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { reportingApi, type VatReportResponse } from '../../lib/reportingApi'
import { getAccessToken, getActiveTenantId } from '../../lib/session'
import { toErrorMessage } from '../../lib/apiClient'
import { formatTaxRate } from '../../lib/taxInheritance'
import { fmtLocalDate } from '../../components/PeriodDropdown'
import DateField from '../../components/DateField'

type PeriodMode = 'day' | 'month' | 'year' | 'custom'

/** Bornes (AAAA-MM-JJ, incluses) de la période choisie ; null tant qu'une période personnalisée est incomplète. */
export function vatRangeFor(mode: PeriodMode, customFrom: string, customTo: string, now: Date = new Date()): { from: string; to: string } | null {
  switch (mode) {
    case 'day': return { from: fmtLocalDate(now), to: fmtLocalDate(now) }
    case 'month': return { from: fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1)), to: fmtLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)) }
    case 'year': return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
    case 'custom': return customFrom && customTo ? { from: customFrom, to: customTo } : null
  }
}

/**
 * TVA collectée par taux sur la période choisie — la base d'une déclaration : base HT, TVA et total TTC pour chaque taux, NETS des
 * retours et des rabais. Réservé au propriétaire (chiffres financiers). Export CSV (feuille de partage) pour le comptable.
 */
export default function VatReport() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [mode, setMode] = useState<PeriodMode>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [report, setReport] = useState<VatReportResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const range = vatRangeFor(mode, customFrom, customTo)
  const from = range?.from
  const to = range?.to

  useEffect(() => {
    if (!from || !to) {
      setReport(null)
      setIsLoading(false)
      return
    }
    let cancelled = false
    setIsLoading(true)
    setError(null)
    reportingApi.getVatReport(from, to)
      .then((r) => { if (!cancelled) setReport(r) })
      .catch((e) => { if (!cancelled) setError(toErrorMessage(e)) })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [from, to])

  /** Écrit le CSV sur disque puis ouvre la feuille de partage OS (même mécanique que l'export du bilan). */
  const exportCsv = async () => {
    if (!from || !to) return
    setExporting(true)
    setError(null)
    try {
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
      const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
      const destination = new File(Paths.cache, `tva-${from}_${to}.csv`)
      const file = await File.downloadFileAsync(`${apiBase}/reports/vat/export?from=${from}&to=${to}&lang=${encodeURIComponent(i18n.language)}`, destination, {
        headers: { Authorization: `Bearer ${token ?? ''}`, 'X-Tenant-ID': tenantId ?? '' },
      })
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(file.uri)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setExporting(false)
    }
  }

  const periods: { id: Exclude<PeriodMode, 'custom'>; label: string }[] = [
    { id: 'day', label: t('reportsAnalytics.periodDay') },
    { id: 'month', label: t('reportsAnalytics.periodMonth') },
    { id: 'year', label: t('reportsAnalytics.periodYear') },
  ]
  const amount = (value: number) => formatNumber(value, locale)

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24, gap: 14 }}>
      <View className="gap-0.5">
        <Text className="text-[21px] font-extrabold tracking-tight">{t('reportsAnalytics.vatTitle')}</Text>
        <Text className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.vatSubtitle')}</Text>
      </View>

      <View className="gap-2">
        <View className="flex-row gap-2">
          {periods.map((p) => (
            <Pressable key={p.id} onPress={() => setMode(p.id)} className={`flex-1 h-[46px] rounded-xl items-center justify-center ${mode === p.id ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
              <Text className={`text-sm ${mode === p.id ? 'text-papier font-extrabold' : 'text-[#5C5147] font-semibold'}`}>{p.label}</Text>
            </Pressable>
          ))}
          <Pressable
            onPress={() => setMode('custom')}
            className={`flex-1 h-[46px] rounded-xl items-center justify-center flex-row gap-1.5 ${mode === 'custom' ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
          >
            <CalendarRange size={14} color={mode === 'custom' ? '#FFFDFA' : '#5C5147'} />
            <Text className={`text-sm ${mode === 'custom' ? 'text-papier font-extrabold' : 'text-[#5C5147] font-semibold'}`}>{t('reportsAnalytics.periodCustom')}</Text>
          </Pressable>
        </View>
        {mode === 'custom' && (
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
      </View>

      <View className="rounded-[20px] bg-bg-card border border-border p-4 gap-3">
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : !report || (report.lines.length === 0 && report.deductibleTax === 0) ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.vatEmpty')}</Text>
        ) : (
          <View className="gap-1">
            <View className="flex-row pb-1.5">
              <Text className="w-[22%] text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.vatRateColumn')}</Text>
              <Text className="flex-1 text-right text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.vatHtColumn')}</Text>
              <Text className="flex-1 text-right text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.vatTaxColumn')}</Text>
              <Text className="flex-1 text-right text-[10px] font-extrabold uppercase text-text-dim">{t('reportsAnalytics.vatTtcColumn')}</Text>
            </View>
            {report.lines.map((line) => (
              <View key={line.exempt ? 'exempt' : (line.ratePercent ?? 'none')} className="flex-row items-center py-2 border-t border-border-hairline">
                <Text className="w-[22%] text-[13px] font-bold">{line.exempt ? t('reportsAnalytics.vatExempt') : line.ratePercent === null ? t('reportsAnalytics.vatNoVat') : `${formatTaxRate(line.ratePercent)} %`}</Text>
                <Text className="amount flex-1 text-right text-[13px] text-text-secondary">{amount(line.totalHt)}</Text>
                <Text className="amount flex-1 text-right text-[13px] font-bold">{amount(line.totalTax)}</Text>
                <Text className="amount flex-1 text-right text-[13px] text-text-secondary">{amount(line.totalTtc)}</Text>
              </View>
            ))}
            <View className="flex-row items-center pt-2 border-t-2 border-border">
              <Text className="w-[22%] text-[13px] font-extrabold text-primary">{t('reportsAnalytics.vatTotal')}</Text>
              <Text className="amount flex-1 text-right text-[13px] font-extrabold text-primary">{amount(report.totalHt)}</Text>
              <Text className="amount flex-1 text-right text-[13px] font-extrabold text-primary">{amount(report.totalTax)}</Text>
              <Text className="amount flex-1 text-right text-[13px] font-extrabold text-primary">{amount(report.totalTtc)}</Text>
            </View>
            <Text className="text-[11px] font-semibold text-text-dim pt-1">{tenant.currency}</Text>

            <View className="gap-1.5 pt-3 mt-2 border-t border-border">
              <View className="flex-row justify-between">
                <Text className="text-[13px] font-semibold text-text-muted">{t('reportsAnalytics.vatTitle')}</Text>
                <Text className="amount text-[13px] font-bold">{amount(report.totalTax)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-[13px] font-semibold text-text-muted">{t('reportsAnalytics.vatDeductible')}</Text>
                <Text className="amount text-[13px] font-bold">− {amount(report.deductibleTax)}</Text>
              </View>
              <View className="flex-row justify-between pt-1.5 border-t border-border-hairline">
                <Text className="text-[14px] font-extrabold text-primary">{report.netTaxPayable < 0 ? t('reportsAnalytics.vatCredit') : t('reportsAnalytics.vatPayable')}</Text>
                <Text className="amount text-[14px] font-extrabold text-primary">{amount(Math.abs(report.netTaxPayable))}</Text>
              </View>
            </View>
          </View>
        )}

        <Text className="text-[11px] leading-snug text-text-muted">{t('reportsAnalytics.vatHelp')}</Text>
      </View>

      <Pressable
        onPress={exportCsv}
        disabled={exporting || isLoading || !report || (report.lines.length === 0 && report.deductibleTax === 0)}
        className="flex-row items-center justify-center gap-2 h-[50px] rounded-2xl bg-primary disabled:opacity-40"
      >
        <Download size={17} color="#FFFDFA" />
        <Text className="text-papier font-extrabold">{exporting ? '...' : t('reportsAnalytics.vatExport')}</Text>
      </Pressable>
    </ScrollView>
  )
}
