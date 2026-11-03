import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Modal } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AlertTriangle, ChevronRight, Lock } from 'lucide-react-native'
import Svg, { Circle, G } from 'react-native-svg'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import KpiCard from '../../components/KpiCard'
import PeriodDropdown, { currentWeekRange, fmtLocalDate, type Period } from '../../components/PeriodDropdown'
import CashCountModal from '../../components/CashCountModal'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { reportingApi, type BilanResponse, type DashboardResponse } from '../../lib/reportingApi'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { cacheDashboard, getCachedDashboard } from '../../lib/reportCache'

/** Clé de clôture locale par boutique/jour — même schéma que DesktopCashJournal (pas de notion de
 *  clôture côté serveur, StockIntake/Sale n'en ont aucune ; volontairement local-only). */
function closureKey(tenantId: string) {
  return `boutiklic_journal_closed_${tenantId}_${fmtLocalDate(new Date())}`
}

const TOP_PRODUCT_COLORS = ['#0E2038', '#D84E2A', '#E69D3B', '#0E7A52']

function pctTrend(current: number, previous: number, t: (key: string, options?: Record<string, unknown>) => string): string | undefined {
  if (previous <= 0) return undefined
  const delta = Math.round(((current - previous) / previous) * 100)
  return t('reportsAnalytics.trendVsYesterday', { value: `${delta >= 0 ? '+' : ''}${delta}` })
}

/** Remplace le `conic-gradient` CSS (pas d'équivalent RN) — anneau SVG segmenté. */
function DonutChart({ segments, size = 118, strokeWidth = 18 }: { segments: { value: number; color: string }[]; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  let cumulative = 0
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
        {segments.map((s, i) => {
          const length = (s.value / 100) * circumference
          const dashArray = `${length} ${circumference - length}`
          const dashOffset = -((cumulative / 100) * circumference)
          cumulative += s.value
          return <Circle key={i} cx={size / 2} cy={size / 2} r={radius} stroke={s.color} strokeWidth={strokeWidth} fill="none" strokeDasharray={dashArray} strokeDashoffset={dashOffset} />
        })}
      </G>
    </Svg>
  )
}

interface DashboardProps {
  onNavigateToStock?: () => void
}

export default function Dashboard({ onNavigateToStock }: DashboardProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { formatCurrency, tenant, activeTenantId } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboardAsOf, setDashboardAsOf] = useState<string | null>(null)

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [bilan, setBilan] = useState<BilanResponse | null>(null)
  const [isBilanLoading, setIsBilanLoading] = useState(false)
  const [bilanError, setBilanError] = useState<string | null>(null)
  const [showCashCountModal, setShowCashCountModal] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [closed, setClosed] = useState(false)

  const isCustomReady = customFrom !== '' && customTo !== ''

  useEffect(() => {
    if (!activeTenantId) return
    AsyncStorage.getItem(closureKey(activeTenantId)).then((v) => setClosed(v !== null))
  }, [activeTenantId])

  const handleConfirmClose = () => {
    AsyncStorage.setItem(closureKey(activeTenantId), new Date().toISOString())
    setClosed(true)
    setShowCloseConfirm(false)
  }

  // Hors ligne (NetworkError seulement) : repli sur le dernier instantané connu (cf. lib/reportCache.ts,
  // plan offline-first Phase 8) — jamais recalculé localement, juste affiché tel quel avec son
  // horodatage. Une erreur métier reste une vraie erreur (pas de repli).
  const refetchDashboard = () =>
    reportingApi
      .getDashboard()
      .then((d) => {
        cacheDashboard(d)
        setData(d)
        setDashboardAsOf(null)
      })
      .catch(async (e) => {
        if (e instanceof NetworkError) {
          const { data: cached, asOf } = await getCachedDashboard()
          if (cached) {
            setData(cached)
            setDashboardAsOf(asOf)
            return
          }
        }
        setError(toErrorMessage(e))
      })

  const refetchBilan = () => {
    if (!isOwner || period === 'today') return
    if (period === 'custom' && !isCustomReady) return
    const request =
      period === 'week' ? reportingApi.getBilanRange(currentWeekRange().from, currentWeekRange().to) : period === 'month' ? reportingApi.getBilan('month') : reportingApi.getBilanRange(customFrom, customTo)
    return request.then(setBilan).catch((e) => setBilanError(toErrorMessage(e)))
  }

  useEffect(() => {
    refetchDashboard().finally(() => setIsLoading(false))
  }, [])

  useEffect(() => {
    // Le bilan (revenue/coût/bénéfice détaillés par période) est réservé au propriétaire côté
    // backend — inutile de l'appeler pour les autres rôles, le sélecteur reste sur "Aujourd'hui".
    if (!isOwner) return
    if (period === 'today') return
    if (period === 'custom' && !isCustomReady) return

    setIsBilanLoading(true)
    setBilanError(null)
    refetchBilan()?.finally(() => setIsBilanLoading(false))
  }, [period, customFrom, customTo])

  const handleCashCountRecorded = () => {
    setShowCashCountModal(false)
    refetchDashboard()
    refetchBilan()
  }

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }
  if (!data) {
    return (
      <View className="flex-1 items-center justify-center px-5">
        <Text className="text-[13px] font-semibold text-danger text-center">{error ?? t('reportsAnalytics.loadError')}</Text>
      </View>
    )
  }

  const maxRevenue = Math.max(...data.last7Days.map((d) => d.revenue), 1)

  const salesLabel = period === 'today' ? t('reportsAnalytics.salesToday') : period === 'week' ? t('reportsAnalytics.salesWeek') : period === 'month' ? t('reportsAnalytics.salesMonth') : t('reportsAnalytics.salesPeriod')

  const salesValue = period === 'today' ? data.salesToday : bilan?.revenue ?? 0
  const profitValue = isOwner ? (period === 'today' ? data.profitToday ?? 0 : bilan?.profit ?? 0) : null
  const salesTrend = period === 'today' ? pctTrend(data.salesToday, data.salesYesterday, t) : undefined
  const profitTrend = isOwner && period === 'today' && data.profitToday !== null && data.profitYesterday !== null ? pctTrend(data.profitToday, data.profitYesterday, t) : undefined

  const chartTitle = period === 'today' ? t('reportsAnalytics.chartTitleToday') : period === 'week' ? t('reportsAnalytics.chartTitleWeek') : period === 'month' ? t('reportsAnalytics.chartTitleMonth') : t('reportsAnalytics.chartTitlePeriod')

  const chartBars = period === 'today' ? data.last7Days.map((d) => ({ value: d.revenue, label: d.dayLabel, active: d.isToday })) : (bilan?.dailyRevenueSeries ?? []).map((v, i) => ({ value: v, label: String(i + 1), active: false }))

  const chartTotal = period === 'today' ? data.last7Days.reduce((s, d) => s + d.revenue, 0) : bilan?.revenue ?? 0
  const chartMax = Math.max(...chartBars.map((b) => b.value), 1)
  const showBarLabels = chartBars.length <= 10

  // Répartition brut/promotions/rabais/caisse (étude "Promotions & Rabais") — réservée au propriétaire
  // côté backend (masquée pour les autres rôles). cashCollected/cashGap restent null tant qu'aucun
  // comptage physique n'a été saisi sur la période (distinct d'un écart de 0).
  const grossSalesValue = period === 'today' ? data.grossSalesToday : bilan?.grossSales ?? null
  const promotionsValue = period === 'today' ? data.promotionsToday : bilan?.promotions ?? null
  const discountsValue = period === 'today' ? data.discountsToday : bilan?.discounts ?? null
  const cashCollectedValue = period === 'today' ? data.cashCollectedToday : bilan?.cashCollected ?? null
  const cashGapValue = period === 'today' ? data.cashGapToday : bilan?.cashGap ?? null

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 14 }} showsVerticalScrollIndicator={false}>
      <View className="relative z-10 flex-row items-center justify-between">
        <View className="gap-0.5">
          <Text className="text-[21px] font-extrabold tracking-tight">{t('reportsAnalytics.greeting')}</Text>
          <Text className="text-[13px] font-semibold text-text-muted">{t('reportsAnalytics.greetingSubtitle')}</Text>
        </View>
        {isOwner && <PeriodDropdown period={period} onPeriodChange={setPeriod} customFrom={customFrom} customTo={customTo} onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo} />}
      </View>

      {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
      {dashboardAsOf && (
        <Text className="text-[13px] font-semibold text-info-text">{t('reportsAnalytics.dashboardAsOf', { time: new Date(dashboardAsOf).toLocaleTimeString() })}</Text>
      )}
      {isOwner && period !== 'today' && bilanError && <Text className="text-[13px] font-semibold text-danger">{bilanError}</Text>}

      <View className="flex-row flex-wrap gap-2.5">
        <View className="w-[48%]">
          <KpiCard variant="indigo" label={salesLabel} value={formatNumber(salesValue, locale)} trend={salesTrend} />
        </View>
        {isOwner && profitValue !== null && (
          <View className="w-[48%]">
            <KpiCard variant="emerald" label={t('reportsAnalytics.profitLabel')} value={formatNumber(profitValue, locale)} trend={profitTrend} />
          </View>
        )}
        <View className="w-[48%]">
          <KpiCard
            variant="terracotta"
            label={t('reportsAnalytics.outstandingDebtLabel')}
            value={formatNumber(data.outstandingDebt, locale)}
            caption={data.debtorCount > 0 ? t('reportsAnalytics.debtorsToFollowUp', { count: data.debtorCount }) : undefined}
          />
        </View>
        {isOwner && data.stockValue !== null && (
          <View className="w-[48%]">
            <KpiCard variant="gold" label={t('reportsAnalytics.stockValueLabel')} value={`${(data.stockValue / 1000000).toFixed(1).replace('.', ',')} M`} caption={t('reportsAnalytics.stockItemCount', { count: data.stockItemCount })} />
          </View>
        )}
      </View>

      {isOwner && (
        <View className="p-[18px] rounded-[20px] bg-bg-card border border-border gap-4">
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-extrabold">{t('reportsAnalytics.cashDetailTitle')}</Text>
            <Pressable onPress={() => setShowCashCountModal(true)}>
              <Text className="text-[13px] font-extrabold text-primary">{t('reportsAnalytics.countCashButton')}</Text>
            </Pressable>
          </View>
          <View className="flex-row justify-between">
            <View className="gap-0.5">
              <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.grossLabel')}</Text>
              <Text className="amount text-[15px] font-extrabold">{grossSalesValue != null ? formatNumber(grossSalesValue, locale) : '—'}</Text>
            </View>
            <View className="gap-0.5">
              <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.promotionsLabel')}</Text>
              <Text className="amount text-[15px] font-extrabold text-terracotta">
                {promotionsValue != null && promotionsValue > 0 ? `−${formatNumber(promotionsValue, locale)}` : '—'}
              </Text>
            </View>
            <View className="gap-0.5">
              <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.discountsLabel')}</Text>
              <Text className="amount text-[15px] font-extrabold text-terracotta">
                {discountsValue != null && discountsValue > 0 ? `−${formatNumber(discountsValue, locale)}` : '—'}
              </Text>
            </View>
          </View>
          <View className="flex-row items-center justify-between pt-3 border-t border-border-hairline">
            <View className="gap-0.5">
              <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.collectedLabel')}</Text>
              <Text className="amount text-[15px] font-extrabold">{cashCollectedValue != null ? formatCurrency(cashCollectedValue) : t('reportsAnalytics.notCountedYet')}</Text>
            </View>
            <View className="gap-0.5 items-end">
              <Text className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('reportsAnalytics.cashGapLabel')}</Text>
              <Text className={`amount text-[15px] font-extrabold ${cashGapValue ? 'text-danger' : ''}`}>
                {cashGapValue != null ? `${cashGapValue > 0 ? '+' : ''}${formatNumber(cashGapValue, locale)}` : '—'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {isOwner && period === 'today' && (
        <View className="p-[18px] rounded-[20px] bg-bg-card border border-border">
          {closed ? (
            <View className="flex-row items-center gap-2">
              <Lock size={16} color="#0E7A52" />
              <Text className="text-[13px] font-extrabold text-succes-text">{t('registerSales.dayAlreadyClosed')}</Text>
            </View>
          ) : (
            <Pressable onPress={() => setShowCloseConfirm(true)} className="flex-row items-center justify-center gap-2 py-1">
              <Lock size={16} color="#111418" />
              <Text className="text-[13px] font-extrabold">{t('registerSales.closeDay')}</Text>
            </Pressable>
          )}
        </View>
      )}

      {(data.lowStockCount > 0 || data.outOfStockCount > 0) && (
        <Pressable onPress={onNavigateToStock} className="p-4 rounded-[20px] bg-alerte-bg border border-[#EED9AE] flex-row items-center gap-3 active:scale-95">
          <View className="w-10 h-10 rounded-full bg-warning/20 items-center justify-center">
            <AlertTriangle size={19} color="#8A6712" />
          </View>
          <View className="flex-1">
            <Text className="text-[15px] font-extrabold text-alerte-text">{t('reportsAnalytics.stockAlertsTitle')}</Text>
            <Text className="text-[13px] font-semibold text-alerte-text/80">
              {data.outOfStockCount > 0 ? t('reportsAnalytics.outOfStockCount', { count: data.outOfStockCount }) : ''}
              {data.outOfStockCount > 0 && data.lowStockCount > 0 ? ' · ' : ''}
              {data.lowStockCount > 0 ? t('reportsAnalytics.lowStockCount', { count: data.lowStockCount }) : ''}
            </Text>
          </View>
          <ChevronRight size={18} color="#8A6712" />
        </Pressable>
      )}

      <View className="p-[18px] rounded-[20px] bg-bg-card border border-border gap-4">
        <Text className="text-[15px] font-extrabold">{t('reportsAnalytics.topSellingTitle')}</Text>
        {data.topProducts.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('reportsAnalytics.noSalesToday')}</Text>
        ) : (
          <View className="flex-row items-center gap-[18px]">
            <View className="w-[118px] h-[118px] items-center justify-center">
              <DonutChart segments={data.topProducts.map((p, i) => ({ value: p.percentageOfTotal, color: TOP_PRODUCT_COLORS[i % TOP_PRODUCT_COLORS.length] }))} />
              <View className="absolute w-16 h-16 rounded-full bg-bg-card items-center justify-center">
                <Text className="amount text-lg font-extrabold">{data.topProducts.length}</Text>
                <Text className="text-[10px] font-bold text-text-dim">{t('reportsAnalytics.productCount', { count: data.topProducts.length })}</Text>
              </View>
            </View>
            <View className="flex-1 gap-2.5">
              {data.topProducts.map((p, i) => (
                <View key={p.productName} className="flex-row items-center gap-2.5">
                  <View className="w-[11px] h-[11px] rounded-sm" style={{ backgroundColor: TOP_PRODUCT_COLORS[i % TOP_PRODUCT_COLORS.length] }} />
                  <Text className="flex-1 text-sm font-semibold" numberOfLines={1}>
                    {p.productName}
                  </Text>
                  <Text className="amount text-sm font-extrabold">{p.percentageOfTotal} %</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      <View className="p-[18px] rounded-[20px] bg-bg-card border border-border gap-3.5">
        <View className="flex-row items-baseline justify-between">
          <Text className="text-[15px] font-extrabold">{chartTitle}</Text>
          <Text className="amount text-[13px] font-bold text-text-muted">{period !== 'today' && isBilanLoading ? '...' : formatCurrency(chartTotal)}</Text>
        </View>
        {period === 'custom' && !isCustomReady ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-4">{t('reportsAnalytics.chooseDateRange')}</Text>
        ) : (
          <View className="h-[78px] flex-row items-end gap-2.5">
            {chartBars.map((bar, i) => (
              <View key={i} className="flex-1 items-center gap-1.5">
                <View
                  className="w-full rounded-[5px]"
                  style={{
                    height: Math.max(4, (bar.value / (period === 'today' ? maxRevenue : chartMax)) * 78),
                    backgroundColor: bar.active ? '#0E2038' : '#DDD2C3',
                  }}
                />
                {showBarLabels && <Text className={`text-[11px] ${bar.active ? 'font-extrabold text-primary' : 'font-bold text-text-dim'}`}>{bar.label}</Text>}
              </View>
            ))}
          </View>
        )}
      </View>

      <CashCountModal open={showCashCountModal} currency={tenant.currency} onClose={() => setShowCashCountModal(false)} onRecorded={handleCashCountRecorded} />

      <Modal visible={showCloseConfirm} transparent animationType="fade" onRequestClose={() => setShowCloseConfirm(false)}>
        <View className="flex-1 bg-black/40 items-center justify-center px-6">
          <View className="w-full max-w-[420px] rounded-[20px] bg-bg-card p-5 gap-4">
            <Text className="text-base font-extrabold">{t('registerSales.closeDayModalTitle')}</Text>
            <Text className="text-[13px] font-semibold text-text-muted leading-relaxed">
              {cashCollectedValue != null
                ? t('registerSales.closeDayModalBody', { sales: formatCurrency(data.salesToday), cash: formatCurrency(cashCollectedValue) })
                : t('registerSales.closeDayModalBodyNoCash', { sales: formatCurrency(data.salesToday) })}
            </Text>
            <View className="flex-row gap-2.5">
              <Pressable onPress={() => setShowCloseConfirm(false)} className="flex-1 h-[48px] rounded-xl border border-border-strong items-center justify-center">
                <Text className="text-text-muted font-bold">{t('registerSales.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleConfirmClose} className="flex-1 h-[48px] rounded-xl bg-primary items-center justify-center">
                <Text className="text-papier font-extrabold">{t('registerSales.confirmCloseDay')}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}
