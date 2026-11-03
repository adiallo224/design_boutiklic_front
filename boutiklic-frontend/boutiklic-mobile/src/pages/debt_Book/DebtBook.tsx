import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { Plus, Send, BookOpen, History, Users } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import { debtApi, type DebtorResponse, type DebtorsTotalResponse } from '../../lib/debtApi'
import { toErrorMessage } from '../../lib/apiClient'
import { openWhatsApp } from '../../lib/whatsapp'
import { useTenant } from '../../hooks/useTenant'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import { formatDate } from '../../lib/dateFormat'

interface DebtBookProps {
  onSelectDebt: (debtor: DebtorResponse) => void
  onAddDebt: () => void
  onOpenHistory: () => void
  onOpenCustomers: () => void
}

function daysUntil(dueDate: string | null): number | null {
  if (!dueDate) return null
  const due = new Date(dueDate)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400000)
}

function meta(debtor: DebtorResponse, t: (key: string, options?: Record<string, unknown>) => string) {
  const days = daysUntil(debtor.nearestDueDate)
  if (debtor.urgency === 'OVERDUE') {
    return { border: '#C6362F', avatarBg: '#F7E3E1', avatarText: '#8F3B23', label: t('debtBook.overdueByDays', { days: Math.abs(days ?? 0) }), labelColor: '#C6362F' }
  }
  if (debtor.urgency === 'DUE_SOON') {
    return { border: '#E69D3B', avatarBg: '#FEF4E6', avatarText: '#8A6712', label: t('debtBook.dueInDays', { days: days ?? 0 }), labelColor: '#8A6712' }
  }
  return {
    border: '#0E7A52',
    avatarBg: '#E6F1EC',
    avatarText: '#1F5C43',
    label: debtor.nearestDueDate ? t('debtBook.dueOn', { date: formatDate(debtor.nearestDueDate) }) : t('debtBook.noDueDate'),
    labelColor: '#676E7E',
  }
}

const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').toUpperCase()

export default function DebtBook({ onSelectDebt, onAddDebt, onOpenHistory, onOpenCustomers }: DebtBookProps) {
  const { t, i18n } = useTranslation()
  const locale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [sort, setSort] = useState<'URGENT' | 'MONTANT'>('URGENT')
  const [debtors, setDebtors] = useState<DebtorResponse[]>([])
  const [total, setTotal] = useState<DebtorsTotalResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    Promise.all([debtApi.getDebtors(sort === 'URGENT' ? 'urgency' : 'amount'), debtApi.getTotal()])
      .then(([d, t]) => {
        setDebtors(d)
        setTotal(t)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [sort])

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 14 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between">
        <Text className="text-[21px] font-extrabold tracking-tight">{t('debtBook.title')}</Text>
        <View className="flex-row gap-2">
          <Pressable onPress={onOpenCustomers} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <Users size={18} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenHistory} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <History size={18} color="#111418" />
          </Pressable>
          <Pressable onPress={onAddDebt} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        </View>
      </View>

      <View className="p-[18px] rounded-[20px] bg-terracotta flex-row items-center justify-between overflow-hidden relative">
        <DiagonalStripes color="#FFFDFA" opacity={0.06} stripeWidth={3} gap={11} />
        <View className="gap-1">
          <Text className="text-xs font-extrabold tracking-widest text-papier/70">{t('debtBook.outstandingLabel')}</Text>
          <Text className="amount text-[30px] font-extrabold text-papier tracking-tight">{formatNumber(total?.totalOutstanding ?? 0, locale)}</Text>
          <Text className="text-[13px] font-semibold text-papier/80">{t('debtBook.clientsCount', { count: total?.debtorCount ?? 0 })} · {tenant.currency}</Text>
        </View>
        <View className="w-14 h-14 rounded-full bg-papier/15 items-center justify-center">
          <BookOpen size={26} color="#FFFDFA" strokeWidth={1.9} />
        </View>
      </View>

      <View className="flex-row gap-2">
        <Pressable onPress={() => setSort('URGENT')} className={`px-4 py-2.5 rounded-[11px] ${sort === 'URGENT' ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${sort === 'URGENT' ? 'text-papier' : 'text-[#5C5147]'}`}>{t('debtBook.sortUrgent')}</Text>
        </Pressable>
        <Pressable onPress={() => setSort('MONTANT')} className={`px-4 py-2.5 rounded-[11px] ${sort === 'MONTANT' ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${sort === 'MONTANT' ? 'text-papier' : 'text-[#5C5147]'}`}>{t('debtBook.sortAmount')}</Text>
        </Pressable>
      </View>

      {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</Text>
      ) : debtors.length === 0 ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('debtBook.emptyState')}</Text>
      ) : (
        <View className="gap-2.5">
          {debtors.map((debtor) => {
            const m = meta(debtor, t)
            return (
              <Pressable
                key={debtor.customerPhone}
                onPress={() => onSelectDebt(debtor)}
                className="p-[15px] rounded-[18px] bg-bg-card border border-border gap-3"
                style={{ borderLeftWidth: 5, borderLeftColor: m.border }}
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-full items-center justify-center" style={{ backgroundColor: m.avatarBg }}>
                    <Text className="text-sm font-extrabold" style={{ color: m.avatarText }}>
                      {initials(debtor.customerName)}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-bold" numberOfLines={1}>
                      {debtor.customerName}
                    </Text>
                    <Text className="text-[13px] font-bold" style={{ color: m.labelColor }}>
                      {m.label}
                    </Text>
                  </View>
                  <Text className="amount text-[19px] font-extrabold">{formatNumber(debtor.totalRemaining, locale)}</Text>
                </View>
                <View className="flex-row gap-2.5">
                  <Pressable onPress={() => onSelectDebt(debtor)} className="flex-1 h-11 rounded-[13px] bg-success items-center justify-center">
                    <Text className="text-papier text-sm font-extrabold">{t('debtBook.repay')}</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      openWhatsApp(
                        debtor.customerPhone,
                        t('debtBook.reminderMessage', { name: debtor.customerName, amount: formatNumber(debtor.totalRemaining, locale), shop: tenant.name }),
                      )
                    }
                    className="flex-1 h-11 rounded-[13px] bg-bg-card border border-border-strong items-center justify-center flex-row gap-1.5"
                  >
                    <Send size={17} color="#5C5147" />
                    <Text className="text-[#5C5147] text-sm font-bold">{t('debtBook.remind')}</Text>
                  </Pressable>
                </View>
              </Pressable>
            )
          })}
        </View>
      )}
    </ScrollView>
  )
}
