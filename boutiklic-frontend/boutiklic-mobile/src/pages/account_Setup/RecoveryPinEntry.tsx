import { View, Text, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Check } from 'lucide-react-native'

interface RecoveryPinEntryProps {
  pin: string[]
  onBack: () => void
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
  loading?: boolean
  error?: string | null
}

/** Dernière vérification avant le nouveau mot de passe (écran "Mot de passe oublié") — exigée
 *  seulement quand le compte a configuré un code de récupération (cf. AuthFlow.tsx, TenantMembership.hasRecoveryPin).
 *  La vérification réelle a lieu côté serveur lors de l'appel resetPassword ; ce clavier ne fait
 *  que collecter les 6 chiffres. */
export default function RecoveryPinEntry({ pin, onBack, onDigit, onClear, onConfirm, loading = false, error = null }: RecoveryPinEntryProps) {
  const { t } = useTranslation()
  const canConfirm = !loading && pin.length === 6
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.recoveryCodeTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.recoveryCodeSubtitle')}</Text>
        </View>
      </View>
      <View className="px-[22px] pb-5">
        <View className="h-1 rounded-full bg-fond-planche">
          <View className="h-1 rounded-full bg-primary" style={{ width: '92%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 24 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const filled = pin[i]
            const active = i === pin.length && pin.length < 6
            return (
              <View
                key={i}
                className={`flex-1 h-[62px] rounded-2xl items-center justify-center ${
                  active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
                }`}
              >
                {filled ? (
                  <Text className="amount text-2xl font-extrabold">{filled}</Text>
                ) : active ? (
                  <View className="w-0.5 h-[24px] bg-encre" />
                ) : null}
              </View>
            )
          })}
        </View>

        <Text className="text-[13px] font-semibold text-text-muted text-center">
          {t('auth.forgotCodeToo')}
        </Text>

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
      </ScrollView>

      <View className="px-4 pb-7">
        <View className="flex-row flex-wrap gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <Pressable
              key={n}
              onPress={() => onDigit(n)}
              className="h-[58px] w-[31%] rounded-2xl bg-bg border border-border items-center justify-center active:scale-95"
            >
              <Text className="text-2xl font-bold">{n}</Text>
            </Pressable>
          ))}
          <Pressable onPress={onClear} className="h-[58px] w-[31%] rounded-2xl items-center justify-center">
            <Text className="text-terracotta text-sm font-bold">{t('auth.clear')}</Text>
          </Pressable>
          <Pressable onPress={() => onDigit('0')} className="h-[58px] w-[31%] rounded-2xl bg-bg border border-border items-center justify-center active:scale-95">
            <Text className="text-2xl font-bold">0</Text>
          </Pressable>
          <Pressable
            onPress={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            className="h-[58px] w-[31%] rounded-2xl bg-primary items-center justify-center disabled:opacity-40 active:scale-95"
          >
            <Check size={24} strokeWidth={2.6} color="#FFFDFA" />
          </Pressable>
        </View>
      </View>
    </View>
  )
}
