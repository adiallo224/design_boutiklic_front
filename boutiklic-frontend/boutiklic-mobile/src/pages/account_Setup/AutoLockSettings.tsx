import { View, Text, Pressable, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Check } from 'lucide-react-native'
import { AUTO_LOCK_NEVER, AUTO_LOCK_OPTIONS } from '../../lib/autoLock'

interface AutoLockSettingsProps {
  selectedMinutes: number
  onBack: () => void
  onSelect: (minutes: number) => void
}

export default function AutoLockSettings({ selectedMinutes, onBack, onSelect }: AutoLockSettingsProps) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.autoLockTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-[20px] border border-border bg-bg-card overflow-hidden">
          {AUTO_LOCK_OPTIONS.map((minutes, i) => (
            <Pressable
              key={minutes}
              onPress={() => onSelect(minutes)}
              className={`flex-row items-center justify-between gap-3 p-4 ${i < AUTO_LOCK_OPTIONS.length - 1 ? 'border-b border-border-hairline' : ''}`}
            >
              <Text className="text-base font-bold">{minutes === AUTO_LOCK_NEVER ? t('auth.autoLockNever') : t('auth.autoLockAfterMinutes', { minutes })}</Text>
              {minutes === selectedMinutes && <Check size={18} color="#0E2038" />}
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  )
}
