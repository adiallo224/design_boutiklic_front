import { View, Text, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Check } from 'lucide-react-native'
import { PHONE_COUNTRIES } from '@boutiklic/shared'

const CODE_LENGTH = 6

type Channel = 'phone' | 'email'
type Mode = 'signup' | 'reset'

interface VerifyCodeProps {
  channel: Channel
  countryId?: string
  phone: string
  email: string
  otp: string[]
  resendIn: number
  onBack: () => void
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
  mode?: Mode
  onResend?: () => void
  loading?: boolean
  error?: string | null
}

export default function VerifyCode({
  channel,
  countryId = 'GN',
  phone,
  email,
  otp,
  resendIn,
  onBack,
  onDigit,
  onClear,
  onConfirm,
  mode = 'signup',
  onResend,
  loading = false,
  error = null,
}: VerifyCodeProps) {
  const { t } = useTranslation()
  const isReset = mode === 'reset'
  const canConfirm = !loading && otp.length === CODE_LENGTH
  const insets = useSafeAreaInsets()
  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{channel === 'phone' ? t('auth.codeReceivedBySms') : t('auth.codeReceivedByEmail')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {isReset ? t('auth.resetLabel') : t('auth.stepTwoOfThree')}
            {channel === 'phone' ? dialCode + ' ' + (phone || '620 12 34 56') : email || 'mariama.diallo@gmail.com'}
          </Text>
        </View>
      </View>

      <View className="px-[22px] pb-5">
        {isReset ? (
          <View className="h-1 rounded-full bg-fond-planche">
            <View className="h-1 rounded-full bg-primary" style={{ width: '85%' }} />
          </View>
        ) : (
          <View className="h-[5px] rounded-full bg-fond-planche flex-row gap-1">
            <View className="flex-1 bg-primary rounded-full" />
            <View className="flex-1 bg-primary rounded-full" />
            <View className="flex-1 bg-fond-planche rounded-full" />
          </View>
        )}
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 24 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row gap-3">
          {Array.from({ length: CODE_LENGTH }, (_, i) => i).map((i) => {
            const filled = otp[i]
            const active = i === otp.length && otp.length < CODE_LENGTH
            return (
              <View
                key={i}
                className={`flex-1 h-[78px] rounded-2xl items-center justify-center ${
                  active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
                }`}
              >
                {filled ? (
                  <Text className="amount text-[34px] font-extrabold">{filled}</Text>
                ) : active ? (
                  <View className="w-0.5 h-[34px] bg-encre" />
                ) : null}
              </View>
            )
          })}
        </View>

        {channel === 'phone' ? (
          <View className="flex-row items-center justify-between">
            <Text className="text-[15px] font-semibold text-text-muted">{t('auth.notReceived')}</Text>
            <Pressable
              onPress={resendIn === 0 ? onResend : undefined}
              disabled={resendIn > 0}
              className={`px-4 py-2.5 rounded-xl ${resendIn > 0 ? 'bg-bg-elevated' : 'bg-primary'}`}
            >
              <Text className={`amount text-sm font-bold ${resendIn > 0 ? 'text-text-muted' : 'text-papier'}`}>
                {resendIn > 0 ? t('auth.resendInSeconds', { seconds: resendIn }) : t('auth.resend')}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text className="text-[15px] font-semibold text-text-muted">{t('auth.notReceivedCheckSpam')}</Text>
            <View className="items-end">
              <Pressable
                onPress={resendIn === 0 ? onResend : undefined}
                disabled={resendIn > 0}
                className={`px-4 py-2.5 rounded-xl ${resendIn > 0 ? 'bg-bg-elevated' : 'bg-primary'}`}
              >
                <Text className={`amount text-sm font-bold ${resendIn > 0 ? 'text-text-muted' : 'text-papier'}`}>
                  {resendIn > 0 ? t('auth.resendInSeconds', { seconds: resendIn }) : t('auth.resend')}
                </Text>
              </Pressable>
            </View>
          </>
        )}

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
