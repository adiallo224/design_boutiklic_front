import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Key, Shield, Mail } from 'lucide-react-native'
import { PhoneIcon, EmailIcon } from '../../components/authIcons'
import PhoneNumberField from '../../components/PhoneNumberField'

type Channel = 'phone' | 'email'

interface ForgotPasswordProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  onSendCode: () => void
  onBack: () => void
  loading?: boolean
  error?: string | null
}

export default function ForgotPassword({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  onSendCode,
  onBack,
  loading = false,
  error = null,
}: ForgotPasswordProps) {
  const { t } = useTranslation()
  const canSubmit = !loading && (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-2.5 px-[22px] pt-2.5 pb-3.5">
        <Pressable onPress={onBack} className="flex-row items-center gap-2.5">
          <ChevronLeft size={18} strokeWidth={2.4} color="#111418" />
          <Text className="text-[15px] font-bold">{t('auth.backToLogin')}</Text>
        </Pressable>
      </View>
      <View className="px-[22px] pb-[22px]">
        <View className="h-1 rounded-full bg-fond-planche">
          <View className="h-1 rounded-full bg-primary" style={{ width: '60%' }} />
        </View>
      </View>

      <View className="px-[22px] pb-5 gap-2">
        <View className="flex-row items-center gap-3">
          <View className="w-11 h-11 rounded-[13px] bg-info-bg items-center justify-center">
            <Key size={21} color="#0E2038" />
          </View>
          <Text className="text-[22px] font-extrabold tracking-tight font-display">{t('auth.forgotPasswordTitle')}</Text>
        </View>
        <Text className="text-sm font-semibold text-text-muted">{t('auth.forgotPasswordSubtitle')}</Text>
      </View>

      <ScrollView
        className="flex-1 mx-[22px] rounded-[22px] bg-bg-card border border-border-strong"
        contentContainerStyle={{ padding: 18, gap: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <Text className="text-[15px] font-extrabold">{t('auth.howReceiveCode')}</Text>

        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => setChannel('phone')}
            className={`flex-1 flex-row items-center justify-center gap-2 h-[46px] rounded-xl ${
              channel === 'phone' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <PhoneIcon color={channel === 'phone' ? '#0E2038' : '#676E7E'} size={16} />
            <Text className={`text-[14px] ${channel === 'phone' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelPhone')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setChannel('email')}
            className={`flex-1 flex-row items-center justify-center gap-2 h-[46px] rounded-xl ${
              channel === 'email' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <EmailIcon color={channel === 'email' ? '#0E2038' : '#676E7E'} size={16} />
            <Text className={`text-[14px] ${channel === 'email' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelEmail')}</Text>
          </Pressable>
        </View>

        {channel === 'phone' ? (
          <>
            <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={phone} setPhone={setPhone} />

            <View className="flex-row gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
              <Shield size={18} color="#0E2038" style={{ marginTop: 2 }} />
              <Text className="flex-1 text-[13px] leading-relaxed text-[#33465E]">{t('auth.smsCodeExplainer')}</Text>
            </View>
          </>
        ) : (
          <>
            <View className="gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.emailAddressLabel')}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="mariama.diallo@gmail.com"
                autoCapitalize="none"
                keyboardType="email-address"
                className="h-[58px] rounded-2xl px-[18px] text-lg font-bold border border-border-strong bg-bg"
              />
            </View>

            <View className="flex-row gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
              <Mail size={18} color="#0E2038" style={{ marginTop: 2 }} />
              <Text className="flex-1 text-[13px] leading-relaxed text-[#33465E]">{t('auth.emailCodeExplainer')}</Text>
            </View>
          </>
        )}

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={() => canSubmit && onSendCode()}
          disabled={!canSubmit}
          className="h-[58px] rounded-2xl bg-primary items-center justify-center flex-row gap-2.5 active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-[17px] font-extrabold">{loading ? t('auth.sending') : `${t('auth.sendCode')} →`}</Text>
        </Pressable>
      </ScrollView>

      <View className="h-5" />
    </View>
  )
}
