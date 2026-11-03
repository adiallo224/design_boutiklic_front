import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import NumericKeypad from '../../components/NumericKeypad'
import { useTenant } from '../../hooks/useTenant'
import { resellerApi } from '../../lib/resellerApi'
import { toErrorMessage } from '../../lib/apiClient'
import { DiagonalStripes } from '../../components/DiagonalStripes'

interface ResellerPaymentProps {
  resellerPhone: string
  resellerName: string
  remainingAmount: number
  onBack: () => void
  onDone: () => void
}

export default function ResellerPayment({ resellerPhone, resellerName, remainingAmount, onBack, onDone }: ResellerPaymentProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const methods: { id: 'CASH' | 'MOBILE_MONEY_ORANGE' | 'MOBILE_MONEY_WAVE'; label: string; icon: string }[] = [
    { id: 'CASH', label: t('resellerConsignment.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('resellerConsignment.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('resellerConsignment.methodWave'), icon: '🌊' },
  ]
  const { tenant } = useTenant()
  const [amount, setAmount] = useState(String(Math.min(150000, remainingAmount)))
  const [method, setMethod] = useState<(typeof methods)[number]['id']>('CASH')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const paid = parseInt(amount.replace(',', '')) || 0
  const remaining = Math.max(0, remainingAmount - paid)

  const handleSubmit = async () => {
    if (paid <= 0 || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await resellerApi.recordPayment(resellerPhone, { amount: paid, currency: tenant.currency, paymentMethod: method })
      onDone()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('resellerConsignment.collectTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {t('resellerConsignment.owesAmount', { name: resellerName, amount: formatNumber(remainingAmount, locale) })}
          </Text>
        </View>
      </View>

      <View className="mx-5 mb-4 p-[22px] rounded-[22px] bg-success gap-1.5 overflow-hidden relative">
        <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />
        <Text className="text-xs font-extrabold tracking-widest text-papier/65">{t('resellerConsignment.bringsBackLabel')}</Text>
        <Text className="amount text-[44px] font-extrabold text-papier tracking-tight">{formatNumber(paid, locale)}</Text>
        <Text className="text-sm font-semibold text-papier/80">{t('resellerConsignment.remainingToCollect', { amount: formatNumber(remaining, locale) })}</Text>
      </View>

      <View className="px-5 pb-4 flex-row gap-2.5">
        {[50000, 150000].map((v) => (
          <Pressable key={v} onPress={() => setAmount(String(v))} className={`flex-1 h-11 rounded-xl items-center justify-center ${paid === v ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
            <Text className={`text-sm ${paid === v ? 'text-papier font-extrabold' : 'text-[#5C5147] font-bold'}`}>{formatNumber(v, locale)}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setAmount(String(remainingAmount))} className={`flex-1 h-11 rounded-xl items-center justify-center ${paid === remainingAmount ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm ${paid === remainingAmount ? 'text-papier font-extrabold' : 'text-[#5C5147] font-bold'}`}>{t('resellerConsignment.settleAll')}</Text>
        </Pressable>
      </View>

      <View className="flex-1 px-4 gap-3">
        <View className="flex-row gap-2.5 px-1">
          {methods.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => setMethod(m.id)}
              className={`flex-1 h-[50px] rounded-[13px] items-center justify-center flex-row gap-1.5 ${
                method === m.id ? 'border-2 border-success bg-succes-bg' : 'border border-border-strong bg-bg-card'
              }`}
            >
              <Text className={`text-sm ${method === m.id ? 'text-succes-text font-extrabold' : 'text-[#5C5147] font-bold'}`}>
                {m.icon} {m.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <NumericKeypad
          onDigit={(d) => setAmount((a) => (a === '0' ? d : a + d))}
          onDecimal={() => setAmount((a) => (a.includes(',') ? a : a + ','))}
          onClear={() => setAmount('')}
          onBackspace={() => setAmount((a) => a.slice(0, -1))}
        />
      </View>

      <View className="px-5 pt-3.5 pb-9 gap-2.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable onPress={handleSubmit} disabled={submitting || paid <= 0} className="h-[62px] rounded-[18px] bg-success items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-lg font-extrabold">{submitting ? t('resellerConsignment.recording') : t('resellerConsignment.recordPaymentButton')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
