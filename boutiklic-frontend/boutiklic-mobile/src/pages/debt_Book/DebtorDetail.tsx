import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, Send } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import { debtApi, type DebtorDetailResponse } from '../../lib/debtApi'
import { salesApi, type SaleLineResponse } from '../../lib/salesApi'
import { toErrorMessage } from '../../lib/apiClient'
import { openWhatsApp } from '../../lib/whatsapp'
import { useTenant } from '../../hooks/useTenant'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import DebtPayment from './DebtPayment'
import { formatDateTime } from '../../lib/dateFormat'

interface DebtorDetailProps {
  customerPhone: string
  urgency?: string
  nearestDueDate?: string | null
  onBack: () => void
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

export default function DebtorDetail({ customerPhone, urgency = 'NORMAL', nearestDueDate = null, onBack }: DebtorDetailProps) {
  const { t, i18n } = useTranslation()
  const locale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [showPayment, setShowPayment] = useState(false)
  const [ledger, setLedger] = useState<DebtorDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Les lignes de vente ne sont pas incluses dans le ledger (module debt) — jointure côté écran
  // via GET /sales/{id} pour chaque achat à crédit, cf. convention hexagonale (pas de repository
  // cross-module côté backend).
  const [saleLines, setSaleLines] = useState<Record<string, SaleLineResponse[]>>({})

  const load = () => {
    setIsLoading(true)
    setError(null)
    debtApi
      .getLedger(customerPhone)
      .then((detail) => {
        setLedger(detail)
        detail.entries
          .filter((e) => e.type === 'CREDIT_PURCHASE' && e.saleId)
          .forEach((e) => {
            const saleId = e.saleId as string
            salesApi
              .getById(saleId)
              .then((sale) => setSaleLines((prev) => ({ ...prev, [saleId]: sale.lines })))
              .catch(() => {})
          })
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [customerPhone])

  if (showPayment) {
    if (!ledger) return null
    return (
      <DebtPayment
        customerPhone={customerPhone}
        customerName={ledger.customerName}
        remainingAmount={ledger.totalRemaining}
        onBack={() => setShowPayment(false)}
        onDone={() => {
          setShowPayment(false)
          load()
        }}
      />
    )
  }

  const days = daysUntil(nearestDueDate)
  const overdueLabel = urgency === 'OVERDUE' ? t('debtBook.daysLate', { days: Math.abs(days ?? 0) }) : urgency === 'DUE_SOON' ? t('debtBook.dueInDays', { days: days ?? 0 }) : null
  const oldestEntry = ledger?.entries[ledger.entries.length - 1]
  const clientSince = oldestEntry ? new Date(oldestEntry.date).getFullYear() : null

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }

  if (!ledger) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-danger">{error ?? t('debtBook.customerNotFound')}</Text>
      </View>
    )
  }

  const progress = ledger.percentPaid

  return (
    <View className="flex-1 bg-bg">
      <View className="bg-primary px-5 pb-6 relative overflow-hidden">
        <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />
        <View className="flex-row items-center justify-between pt-4 pb-5">
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl bg-papier/15 items-center justify-center">
            <ChevronLeft size={20} color="#FFFDFA" />
          </Pressable>
        </View>
        <View className="flex-row items-center gap-3.5">
          <View className="w-[62px] h-[62px] rounded-full bg-warning items-center justify-center">
            <Text className="text-xl font-extrabold text-encre">{ledger.customerName.split(' ').map((p) => p[0]).join('')}</Text>
          </View>
          <View className="gap-0.5">
            <Text className="font-display text-2xl font-extrabold text-papier tracking-tight">{ledger.customerName}</Text>
            <Text className="amount text-sm font-semibold text-papier/70">
              {customerPhone}
              {clientSince ? t('debtBook.clientSince', { year: clientSince }) : ''}
            </Text>
          </View>
        </View>
      </View>

      <View className="px-5 pt-4 pb-3.5">
        <View className="p-[18px] rounded-[20px] bg-[#F7E3E1] border border-[#F0C9C2] gap-2.5">
          <View className="flex-row items-baseline justify-between">
            <Text className="text-xs font-extrabold tracking-widest text-[#8F3B23]">{t('debtBook.balanceDue')}</Text>
            {overdueLabel && <Text className="text-[13px] font-bold text-danger">{overdueLabel}</Text>}
          </View>
          <Text className="amount text-[34px] font-extrabold text-[#8F3B23] tracking-tight">{formatNumber(ledger.totalRemaining, locale)} {tenant.currency}</Text>
          <View className="h-2 rounded-[5px] bg-danger/20 overflow-hidden">
            <View className="h-full rounded-[5px] bg-success" style={{ width: `${progress}%` }} />
          </View>
          <Text className="text-[13px] font-semibold text-[#7A3A26]">
            {t('debtBook.paidOfTotal', { paid: formatNumber(ledger.totalPaid, locale), total: formatNumber(ledger.totalOriginal, locale) })}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 4 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim mb-1">{t('debtBook.historyLabel')}</Text>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {ledger.entries.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('debtBook.noMovement')}</Text>
        ) : (
          ledger.entries.map((entry, i) => {
            const positive = entry.type === 'REPAYMENT'
            const isLast = i === ledger.entries.length - 1
            const lines = entry.saleId ? saleLines[entry.saleId] : undefined
            const itemsSummary = lines?.map((l) => `${l.productName} ×${l.quantity}`).join(', ')
            return (
              <View key={i} className="flex-row gap-3">
                <View className="items-center gap-0.5">
                  <View className="w-[11px] h-[11px] rounded-full" style={{ backgroundColor: positive ? '#0E7A52' : '#D84E2A' }} />
                  {!isLast && <View className="w-0.5 flex-1 bg-border-hairline" style={{ minHeight: 20 }} />}
                </View>
                <View className="flex-1 pb-3.5 flex-row justify-between items-start">
                  <View className="flex-1 gap-0.5 pr-2">
                    <Text className="text-[15px] font-bold">
                      {positive ? t('debtBook.repaymentTitle') : t('debtBook.creditPurchase')}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </Text>
                    <Text className="text-[13px] text-text-dim">{formatDateTime(entry.date, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</Text>
                    {itemsSummary && (
                      <Text className="text-[13px] text-text-dim" numberOfLines={2}>
                        {itemsSummary}
                      </Text>
                    )}
                  </View>
                  <Text className={`amount text-base font-extrabold ${positive ? 'text-succes-text' : 'text-[#8F3B23]'}`}>
                    {positive ? '+' : '−'}
                    {formatNumber(entry.amount, locale)}
                  </Text>
                </View>
              </View>
            )
          })
        )}
      </ScrollView>

      {ledger.totalRemaining > 0 && (
        <View className="px-5 pt-4 pb-9 flex-row gap-2.5">
          <Pressable
            onPress={() =>
              openWhatsApp(
                customerPhone,
                t('debtBook.reminderMessage', { name: ledger.customerName, amount: formatNumber(ledger.totalRemaining, locale), shop: tenant.name }),
              )
            }
            className="flex-1 h-[62px] rounded-[17px] bg-bg-card border border-border-strong items-center justify-center flex-row gap-2"
          >
            <Send size={19} color="#111418" />
            <Text className="text-base font-bold">{t('debtBook.remind')}</Text>
          </Pressable>
          <Pressable onPress={() => setShowPayment(true)} className="flex-[1.3] h-[62px] rounded-[17px] bg-success items-center justify-center">
            <Text className="text-papier text-[17px] font-extrabold">{t('debtBook.cashIn')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  )
}
