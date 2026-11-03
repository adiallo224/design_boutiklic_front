import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Alert } from 'react-native'
import { ChevronLeft, Archive, Trash2 } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import { debtApi, type DebtHistoryEntryResponse } from '../../lib/debtApi'
import { toErrorMessage } from '../../lib/apiClient'
import { formatDate } from '../../lib/dateFormat'

interface DebtHistoryProps {
  onBack: () => void
  onSelectDebt: (debtor: { customerPhone: string }) => void
}

const initials = (name: string) => name.split(' ').map((p) => p[0]).join('').toUpperCase()

export default function DebtHistory({ onBack, onSelectDebt }: DebtHistoryProps) {
  const { t, i18n } = useTranslation()
  const locale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [entries, setEntries] = useState<DebtHistoryEntryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyDebtId, setBusyDebtId] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    setError(null)
    debtApi.getHistory()
      .then(setEntries)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const archive = async (entry: DebtHistoryEntryResponse) => {
    setBusyDebtId(entry.debtId)
    try {
      await debtApi.archiveDebt(entry.debtId)
      setEntries((prev) => prev.map((e) => (e.debtId === entry.debtId ? { ...e, archived: true } : e)))
    } catch (e) {
      Alert.alert(t('debtBook.errorTitle'), toErrorMessage(e))
    } finally {
      setBusyDebtId(null)
    }
  }

  const confirmDelete = (entry: DebtHistoryEntryResponse) => {
    Alert.alert(
      t('debtBook.deleteConfirmTitle'),
      t('debtBook.deleteConfirmMessage', { name: entry.customerName }),
      [
        { text: t('debtBook.cancel'), style: 'cancel' },
        {
          text: t('debtBook.delete'),
          style: 'destructive',
          onPress: async () => {
            setBusyDebtId(entry.debtId)
            try {
              await debtApi.deleteDebt(entry.debtId)
              setEntries((prev) => prev.filter((e) => e.debtId !== entry.debtId))
            } catch (e) {
              Alert.alert(t('debtBook.errorTitle'), toErrorMessage(e))
            } finally {
              setBusyDebtId(null)
            }
          },
        },
      ],
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('debtBook.historyTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('debtBook.historySubtitle')}</Text>
        </View>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 10 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</Text>
        ) : entries.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('debtBook.historyEmptyState')}</Text>
        ) : (
          entries.map((entry) => {
            const busy = busyDebtId === entry.debtId
            return (
              <Pressable
                key={entry.debtId}
                onPress={() => onSelectDebt({ customerPhone: entry.customerPhone })}
                className="p-[15px] rounded-[18px] bg-bg-card border border-border gap-3"
              >
                <View className="flex-row items-center gap-3">
                  <View className="w-11 h-11 rounded-full items-center justify-center bg-[#E6F1EC]">
                    <Text className="text-sm font-extrabold" style={{ color: '#1F5C43' }}>
                      {initials(entry.customerName)}
                    </Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-bold" numberOfLines={1}>
                      {entry.customerName}
                    </Text>
                    <Text className="text-[13px] font-bold text-text-dim">
                      {t('debtBook.settledOn', { date: formatDate(entry.settledAt) })}
                      {entry.archived ? ` · ${t('debtBook.archivedTag')}` : ''}
                    </Text>
                  </View>
                  <Text className="amount text-[19px] font-extrabold">{formatNumber(entry.totalAmount, locale)}</Text>
                </View>
                <View className="flex-row gap-2.5">
                  {!entry.archived && (
                    <Pressable
                      onPress={() => archive(entry)}
                      disabled={busy}
                      className="flex-1 h-11 rounded-[13px] bg-bg-card border border-border-strong items-center justify-center flex-row gap-1.5 disabled:opacity-50"
                    >
                      <Archive size={16} color="#5C5147" />
                      <Text className="text-[#5C5147] text-sm font-bold">{t('debtBook.archive')}</Text>
                    </Pressable>
                  )}
                  <Pressable
                    onPress={() => confirmDelete(entry)}
                    disabled={busy}
                    className="flex-1 h-11 rounded-[13px] bg-[#F7E3E1] items-center justify-center flex-row gap-1.5 disabled:opacity-50"
                  >
                    <Trash2 size={16} color="#8F3B23" />
                    <Text className="text-[#8F3B23] text-sm font-bold">{t('debtBook.delete')}</Text>
                  </Pressable>
                </View>
              </Pressable>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
