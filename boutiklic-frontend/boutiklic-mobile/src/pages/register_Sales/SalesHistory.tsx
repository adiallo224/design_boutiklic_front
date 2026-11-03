import { useEffect, useRef, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, FileText } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { salesApi, type SaleHistoryItemResponse } from '../../lib/salesApi'
import { hasPaidDebtPortion } from '../../lib/saleCancelGuard'
import { hasPaymentMethod } from '../../lib/salePayments'
import { toErrorMessage } from '../../lib/apiClient'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import PeriodDropdown, { currentWeekRange, fmtLocalDate, type Period } from '../../components/PeriodDropdown'
import SaleReturn from './SaleReturn'
import GenerateInvoice from '../billing/GenerateInvoice'
import { formatTime } from '../../lib/dateFormat'

type Filter = 'TOUT' | 'CASH' | 'MOBILE' | 'MIXED' | 'DETTE'

function startOfDayIso(dateStr: string): string {
  return `${dateStr}T00:00:00.000Z`
}
function endOfDayIso(dateStr: string): string {
  return `${dateStr}T23:59:59.999Z`
}
function monthStart(): string {
  const now = new Date()
  return fmtLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))
}
function monthEnd(): string {
  const now = new Date()
  return fmtLocalDate(new Date(now.getFullYear(), now.getMonth() + 1, 0))
}

const LONG_PRESS_MS = 600

export default function SalesHistory({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const SUMMARY_LABELS: Record<Period, string> = {
    today: t('registerSales.summaryToday'),
    week: t('registerSales.summaryWeek'),
    month: t('registerSales.summaryMonth'),
    custom: t('registerSales.summaryCustom'),
  }
  const PAYMENT_LABELS: Record<string, { label: string; bg: string; color: string }> = {
    CASH: { label: t('registerSales.methodCash'), bg: '#E6F1EC', color: '#1F5C43' },
    MOBILE_MONEY_ORANGE: { label: t('registerSales.methodOrangeMoney'), bg: '#F4E3DE', color: '#8F3B23' },
    MOBILE_MONEY_WAVE: { label: t('registerSales.methodWave'), bg: '#E4EAF2', color: '#0E2038' },
    DEBT: { label: t('registerSales.methodDebt'), bg: '#FEF4E6', color: '#8A6712' },
    MIXED: { label: t('registerSales.methodMixed'), bg: '#EDE6D0', color: '#6B5F4E' },
  }
  const { formatCurrency } = useTenant()
  const [filter, setFilter] = useState<Filter>('TOUT')
  const [sales, setSales] = useState<SaleHistoryItemResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [returnSale, setReturnSale] = useState<{ id: string; time: string } | null>(null)
  const [invoicingSaleId, setInvoicingSaleId] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<{ id: string; reason: string } | null>(null)
  const [cancelSubmitting, setCancelSubmitting] = useState(false)

  const [period, setPeriod] = useState<Period>('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const isCustomReady = customFrom !== '' && customTo !== ''

  const longPressTriggered = useRef(false)

  const load = async () => {
    if (period === 'custom' && !isCustomReady) {
      setSales([])
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const [from, to] =
        period === 'today'
          ? [undefined, undefined]
          : period === 'week'
            ? [startOfDayIso(currentWeekRange().from), endOfDayIso(currentWeekRange().to)]
            : period === 'month'
              ? [startOfDayIso(monthStart()), endOfDayIso(monthEnd())]
              : [startOfDayIso(customFrom), endOfDayIso(customTo)]
      const history = await salesApi.getHistory(from, to)
      setSales(history)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, customFrom, customTo])

  if (returnSale) {
    return <SaleReturn saleId={returnSale.id} time={returnSale.time} onBack={() => setReturnSale(null)} />
  }

  if (invoicingSaleId) {
    return <GenerateInvoice saleId={invoicingSaleId} onBack={() => setInvoicingSaleId(null)} />
  }

  const filtered = sales.filter((s) => {
    if (filter === 'TOUT') return true
    // Par tranche de règlement : une vente mixte (ex. espèces + dette) apparaît sous chacun de ses modes ET sous « Mixte ».
    if (filter === 'CASH') return hasPaymentMethod(s, 'CASH')
    if (filter === 'MOBILE') return hasPaymentMethod(s, 'MOBILE_MONEY_ORANGE') || hasPaymentMethod(s, 'MOBILE_MONEY_WAVE')
    if (filter === 'MIXED') return s.paymentMethod === 'MIXED'
    return hasPaymentMethod(s, 'DEBT')
  })

  const completedSales = sales.filter((s) => s.status !== 'CANCELLED')
  const totalRevenue = completedSales.reduce((sum, s) => sum + s.totalAmount, 0)
  const totalSales = completedSales.length

  const handleTap = (sale: SaleHistoryItemResponse) => {
    if (longPressTriggered.current || sale.status === 'CANCELLED') {
      longPressTriggered.current = false
      return
    }
    setReturnSale({ id: sale.saleId, time: formatTime(sale.createdAt) })
  }

  const confirmCancel = async () => {
    if (!cancelling || cancelling.reason.trim().length === 0) return
    setCancelSubmitting(true)
    setError(null)
    try {
      if (await hasPaidDebtPortion(cancelling.id)) {
        setError(t('registerSales.cannotCancelPaidDebtSale'))
        setCancelling(null)
        return
      }
      await salesApi.cancel(cancelling.id, cancelling.reason.trim())
      setCancelling(null)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setCancelSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="relative z-10 flex-row items-center justify-between px-5 pt-2.5 pb-3.5">
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="text-[21px] font-extrabold tracking-tight">{t('registerSales.history')}</Text>
        </View>
        <PeriodDropdown
          period={period}
          onPeriodChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomFromChange={setCustomFrom}
          onCustomToChange={setCustomTo}
        />
      </View>

      <View className="px-5 pb-3.5">
        <View className="p-4 rounded-[18px] bg-primary flex-row items-center justify-between overflow-hidden relative">
          <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />
          <View className="gap-1">
            <Text className="text-[11px] font-extrabold tracking-widest text-papier/60">{SUMMARY_LABELS[period]}</Text>
            <Text className="amount text-2xl font-extrabold text-papier">{formatCurrency(totalRevenue)}</Text>
          </View>
          <View className="items-end gap-0.5">
            <Text className="amount text-lg font-extrabold text-warning">{totalSales}</Text>
            <Text className="text-[11px] font-bold text-papier/60">{t('registerSales.salesCountLabel')}</Text>
          </View>
        </View>
      </View>

      <View className="px-5 pb-3 flex-row gap-2">
        {[
          { id: 'TOUT' as const, label: t('registerSales.filterAll') },
          { id: 'CASH' as const, label: t('registerSales.methodCash') },
          { id: 'MOBILE' as const, label: t('registerSales.filterMobile') },
          { id: 'MIXED' as const, label: t('registerSales.methodMixed') },
          { id: 'DETTE' as const, label: t('registerSales.methodDebt') },
        ].map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setFilter(c.id)}
            className={`px-4 py-2.5 rounded-[11px] ${filter === c.id ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
          >
            <Text className={`text-sm ${filter === c.id ? 'font-bold text-papier' : 'font-semibold text-[#5C5147]'}`}>{c.label}</Text>
          </Pressable>
        ))}
      </View>

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</Text>
        ) : period === 'custom' && !isCustomReady ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.chooseDateRange')}</Text>
        ) : filtered.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.noSalesYet')}</Text>
        ) : (
          filtered.map((sale) => {
            const cancelled = sale.status === 'CANCELLED'
            const payment = PAYMENT_LABELS[sale.paymentMethod] ?? { label: sale.paymentMethod, bg: '#EDE6D0', color: '#6B5F4E' }
            const badge = cancelled ? (sale.cancelledBy ? t('registerSales.cancelledByLabel', { name: sale.cancelledBy }) : t('registerSales.cancelledLabel')) : payment.label
            const badgeBg = cancelled ? '#F7E3E1' : payment.bg
            const badgeColor = cancelled ? '#8F3B23' : payment.color
            return (
              <Pressable
                key={sale.saleId}
                onPress={() => handleTap(sale)}
                onLongPress={() => {
                  if (cancelled) return
                  longPressTriggered.current = true
                  setCancelling({ id: sale.saleId, reason: '' })
                }}
                delayLongPress={LONG_PRESS_MS}
                className={`flex-row items-center gap-3.5 p-3.5 rounded-2xl bg-bg-card ${cancelled ? 'border border-dashed border-[#E0B9B1] opacity-75' : 'border border-border'}`}
              >
                <Text className="amount text-sm font-extrabold w-11">{formatTime(sale.createdAt)}</Text>
                <View className="flex-1 gap-1">
                  <Text className="text-[15px] font-bold">
                    {t('registerSales.itemCount', { count: sale.itemCount })}
                  </Text>
                  <View className="self-start px-2.5 py-0.5 rounded-lg" style={{ backgroundColor: badgeBg }}>
                    <Text className="text-[11px] font-extrabold" style={{ color: badgeColor }}>
                      {badge}
                    </Text>
                  </View>
                </View>
                <Text className="amount text-base font-extrabold">{sale.totalAmount.toLocaleString('fr-FR')},00</Text>
                {!cancelled && (
                  <Pressable
                    onPress={() => {
                      longPressTriggered.current = true
                      setInvoicingSaleId(sale.saleId)
                    }}
                    className="w-8 h-8 rounded-lg border border-border-strong items-center justify-center"
                  >
                    <FileText size={14} color="#676E7E" />
                  </Pressable>
                )}
              </Pressable>
            )
          })
        )}
      </ScrollView>

      {cancelling ? (
        <View className="px-5 pt-3 pb-9 gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.cancelReasonTitle')}</Text>
          <TextInput
            value={cancelling.reason}
            onChangeText={(v) => setCancelling({ ...cancelling, reason: v })}
            placeholder={t('registerSales.cancelReasonPlaceholder')}
            className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold"
          />
          <View className="flex-row gap-2.5">
            <Pressable onPress={() => setCancelling(null)} className="flex-1 h-[52px] rounded-2xl border border-border-strong items-center justify-center">
              <Text className="text-text-muted font-bold">{t('registerSales.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={confirmCancel}
              disabled={cancelSubmitting || cancelling.reason.trim().length === 0}
              className="flex-[1.5] h-[52px] rounded-2xl bg-danger items-center justify-center disabled:opacity-50"
            >
              <Text className="text-papier font-extrabold">{cancelSubmitting ? t('registerSales.cancelling') : t('registerSales.confirmCancellation')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="px-5 pt-3 pb-4">
          <View className="min-h-[52px] rounded-2xl border border-border-strong bg-bg-card items-center justify-center px-4 py-2.5">
            <Text className="text-center text-sm font-bold text-[#5C5147]">{t('registerSales.longPressToCancel')}</Text>
          </View>
        </View>
      )}
    </View>
  )
}
