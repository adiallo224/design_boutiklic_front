import { useEffect, useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { CalendarRange, Download, Send } from 'lucide-react-native'
import { File, Directory, Paths } from 'expo-file-system'
import * as Sharing from 'expo-sharing'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { reportingApi, type BilanPeriod, type ExportFormat, type BilanResponse } from '../../lib/reportingApi'
import { getAccessToken, getActiveTenantId } from '../../lib/session'
import { toErrorMessage } from '../../lib/apiClient'
import DateField from '../../components/DateField'
import { formatDate } from '../../lib/dateFormat'

type PeriodMode = BilanPeriod | 'custom'

export default function ExportReport() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
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
    request
      .then(setBilan)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [mode, customFrom, customTo])

  /** Écrit le bilan exporté sur disque puis ouvre la feuille de partage OS — remplace le
   *  téléchargement navigateur (URL.createObjectURL + <a download>, inexistant en RN). */
  const handleExport = async () => {
    if (mode === 'custom' && !isCustomReady) return
    setExporting(true)
    setError(null)
    try {
      const query = mode === 'custom' ? `from=${customFrom}&to=${customTo}&format=${format}` : `period=${mode}&format=${format}`
      const apiBase = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://localhost:8080/api/v1'
      const [token, tenantId] = await Promise.all([getAccessToken(), getActiveTenantId()])
      const suffix = mode === 'custom' ? `${customFrom}_${customTo}` : mode
      const ext = format === 'image' ? 'png' : format === 'excel' ? 'xlsx' : 'pdf'

      const destination = new File(Paths.cache, `bilan-${suffix}.${ext}`)
      const file = await File.downloadFileAsync(`${apiBase}/reports/export?${query}`, destination, {
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

  const maxDaily = Math.max(...(bilan?.dailyRevenueSeries ?? [1]), 1)

  return (
    <View className="flex-1 bg-bg px-5 pt-4 gap-3.5">
      <Text className="text-[21px] font-extrabold tracking-tight">{t('reportsAnalytics.sendReportTitle')}</Text>

      <View className="gap-2">
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.periodSectionTitle')}</Text>
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

      <View className="flex-1 rounded-[20px] bg-bg-card border border-border p-5 gap-3.5">
        <View className="flex-row items-center justify-between pb-3 border-b-2 border-primary">
          <View className="gap-0.5">
            <Text className="font-display text-base font-extrabold">{tenant.name.toUpperCase()}</Text>
            <Text className="text-[11px] font-semibold text-text-dim">
              {bilan ? t('reportsAnalytics.reportRange', { from: formatDate(bilan.periodStart), to: formatDate(bilan.periodEnd) }) : t('reportsAnalytics.reportWord')}
            </Text>
          </View>
          <View className="w-[34px] h-[34px] rounded-[10px] bg-primary items-center justify-center">
            <View className="w-[15px] h-[15px] rounded" style={{ borderWidth: 3, borderColor: '#FFFDFA', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
          </View>
        </View>

        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : bilan ? (
          <>
            <View className="gap-2.5">
              <View className="flex-row justify-between">
                <Text className="text-sm font-semibold text-[#5C5147]">{t('reportsAnalytics.revenueLabel')}</Text>
                <Text className="amount text-sm font-extrabold">{formatNumber(bilan.revenue, locale)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-semibold text-[#5C5147]">{t('reportsAnalytics.costOfGoodsLabel')}</Text>
                <Text className="amount text-sm font-extrabold">{formatNumber(bilan.costOfGoodsSold, locale)}</Text>
              </View>
              <View className="flex-row justify-between pt-2.5 border-t border-dashed border-[#DDD2C3]">
                <Text className="text-sm font-extrabold">{t('reportsAnalytics.profitWord')}</Text>
                <Text className="amount text-sm font-extrabold text-succes-text">{formatNumber(bilan.profit, locale)}</Text>
              </View>
              <View className="flex-row justify-between">
                <Text className="text-sm font-semibold text-[#5C5147]">{t('reportsAnalytics.outstandingDebtsLabel')}</Text>
                <Text className="amount text-sm font-extrabold text-[#8F3B23]">{formatNumber(bilan.outstandingDebt, locale)}</Text>
              </View>
            </View>
            {bilan.dailyRevenueSeries.length > 0 && (
              <View className="h-[52px] flex-row items-end gap-1.5 pt-1.5">
                {bilan.dailyRevenueSeries.map((v, i) => (
                  <View
                    key={i}
                    className="flex-1 rounded-sm"
                    style={{ height: Math.max(4, (v / maxDaily) * 52), backgroundColor: i === bilan.dailyRevenueSeries.length - 1 ? '#0E2038' : '#E4EAF2' }}
                  />
                ))}
              </View>
            )}
          </>
        ) : mode === 'custom' ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">Choisissez une plage de dates</Text>
        ) : null}

        <Text className="mt-auto pt-3 border-t border-dashed border-[#DDD2C3] text-[11px] font-semibold text-text-dim text-center">
          Généré par BOUTIKLIC · {formatDate(new Date())}
        </Text>
      </View>

      <View className="flex-row gap-2.5">
        {(['pdf', 'image', 'excel'] as const).map((f) => (
          <Pressable
            key={f}
            onPress={() => setFormat(f)}
            className={`flex-1 h-[52px] rounded-2xl items-center justify-center ${format === f ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
          >
            <Text className={`text-[15px] ${format === f ? 'text-primary font-extrabold' : 'text-[#5C5147] font-bold'}`}>{f === 'pdf' ? 'PDF' : f === 'image' ? 'Image' : 'Excel'}</Text>
          </Pressable>
        ))}
      </View>

      <View className="flex-row gap-2.5 pb-1">
        <Pressable
          onPress={handleExport}
          disabled={exporting || (mode === 'custom' && !isCustomReady)}
          className="flex-1 h-[62px] rounded-[17px] bg-success items-center justify-center flex-row gap-2.5 disabled:opacity-50"
        >
          <Send size={20} color="#FFFDFA" />
          <Text className="text-papier text-base font-extrabold">WhatsApp</Text>
        </Pressable>
        <Pressable onPress={handleExport} disabled={exporting || (mode === 'custom' && !isCustomReady)} className="w-[62px] h-[62px] rounded-[17px] bg-bg-card border border-border-strong items-center justify-center disabled:opacity-50">
          <Download size={22} color="#111418" />
        </Pressable>
      </View>
    </View>
  )
}
