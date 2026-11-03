import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useOutbox } from '../../hooks/useOutbox'
import { useTenant } from '../../hooks/useTenant'

export default function SyncSuccess({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()

  function formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(diffMs / 60000)
    if (minutes < 1) return t('settings.justNow')
    if (minutes < 60) return t('settings.minutesAgo', { count: minutes })
    const hours = Math.round(minutes / 60)
    return t('settings.hoursAgo', { count: hours })
  }

  const { formatCurrency } = useTenant()
  const { syncLog } = useOutbox()
  const lastSync = syncLog[0]

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.sync')}</Text>
          <View className="flex-row items-center gap-1.5">
            <View className="w-2 h-2 rounded-full bg-success" />
            <Text className="text-[13px] font-semibold text-text-muted">{t('settings.online')}</Text>
          </View>
        </View>
      </View>

      <View className="px-5 pb-4">
        <View className="flex-row items-center gap-3.5 p-5 rounded-[20px] bg-succes-bg border border-[#C9E2D6]">
          <View className="w-12 h-12 rounded-2xl bg-success items-center justify-center">
            <Check size={24} strokeWidth={2.8} color="#FFFDFA" />
          </View>
          <View className="gap-0.5">
            <Text className="text-lg font-extrabold text-succes-text">{t('settings.allSynced')}</Text>
            <Text className="text-[13px] font-semibold text-[#3E7A61]">{lastSync ? t('settings.lastSyncAt', { when: formatRelative(lastSync.completedAt) }) : t('settings.noOfflineSales')}</Text>
          </View>
        </View>
      </View>

      {syncLog.length > 0 && (
        <View className="px-5 pb-4">
          <View className="rounded-[20px] bg-bg-card border border-border overflow-hidden">
            <Text className="px-[18px] pt-3.5 pb-2 text-xs font-extrabold tracking-widest text-text-dim">{t('settings.recentSyncedSales')}</Text>
            {syncLog.slice(0, 5).map((entry, i) => (
              <View key={i} className="flex-row items-center justify-between px-[18px] py-3.5 border-t border-border-hairline">
                <Text className="text-base font-bold">{formatCurrency(entry.totalAmount)}</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-[13px] font-semibold text-text-dim">{formatRelative(entry.completedAt)}</Text>
                  <View className="w-5 h-5 rounded-full bg-succes-bg items-center justify-center">
                    <Check size={11} strokeWidth={3.2} color="#1F5C43" />
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false}>
        <View className="p-4 rounded-[18px] bg-info-bg border border-info-border">
          <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.offlineSalesOnlyNotice')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}
