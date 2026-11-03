import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff } from 'lucide-react-native'
import { FingerprintIcon, PhoneIcon, EmailIcon } from '../../components/authIcons'
import PhoneNumberField from '../../components/PhoneNumberField'

type Channel = 'phone' | 'email'

interface LoginProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onLogin: () => void
  onSwitchToSignup: () => void
  onForgotPassword: () => void
  /** Absent = bouton masqué : pas de passkey utilisable, ou appareil jamais connecté ici. */
  onFingerprintLogin?: () => void
  fingerprintLoading?: boolean
  loading?: boolean
  error?: string | null
}

export default function Login({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  onLogin,
  onSwitchToSignup,
  onForgotPassword,
  onFingerprintLogin,
  fingerprintLoading = false,
  loading = false,
  error = null,
}: LoginProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const canSubmit = !loading && password.trim().length > 0 && (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="items-center gap-2.5 pt-5 pb-5 px-[22px]">
        <View
          className="w-[52px] h-[52px] rounded-[15px] bg-primary items-center justify-center"
        >
          <View className="w-5 h-5 rounded border-[3px]" style={{ borderColor: '#FFFDFA', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
        </View>
        <Text className="font-display font-extrabold text-[22px] tracking-tight">{t('auth.welcomeTitle')}</Text>
        <Text className="text-sm font-semibold text-text-muted">{t('auth.welcomeSubtitle')}</Text>
      </View>

      <View className="px-[22px] pb-3.5">
        <View className="flex-row gap-2.5">
          <Pressable
            onPress={() => setChannel('phone')}
            className={`flex-1 flex-row items-center justify-center gap-2 h-[42px] rounded-xl ${
              channel === 'phone' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <PhoneIcon color={channel === 'phone' ? '#0E2038' : '#676E7E'} />
            <Text className={`text-[13px] ${channel === 'phone' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelPhone')}</Text>
          </Pressable>
          <Pressable
            onPress={() => setChannel('email')}
            className={`flex-1 flex-row items-center justify-center gap-2 h-[42px] rounded-xl ${
              channel === 'email' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <EmailIcon color={channel === 'email' ? '#0E2038' : '#676E7E'} />
            <Text className={`text-[13px] ${channel === 'email' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelEmail')}</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        {channel === 'phone' ? (
          <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={phone} setPhone={setPhone} />
        ) : (
          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.emailAddressLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="mariama.diallo@gmail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="h-[60px] rounded-2xl px-[18px] text-lg font-extrabold border border-border-strong bg-bg"
            />
          </View>
        )}

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.passwordLabel')}</Text>
          <View className="h-[60px] rounded-2xl border border-border-strong bg-bg flex-row items-center px-[18px] gap-3">
            <TextInput
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              className="flex-1 text-lg font-extrabold tracking-[.14em]"
            />
            <Pressable onPress={() => setShowPassword((s) => !s)} disabled={password.length === 0}>
              {showPassword ? <EyeOff size={20} color="#A2A9B8" /> : <Eye size={20} color="#A2A9B8" />}
            </Pressable>
          </View>
          <Pressable onPress={onForgotPassword} className="self-end">
            <Text className="text-[13px] font-bold text-terracotta">{t('auth.forgotPasswordLink')}</Text>
          </Pressable>
        </View>

        {onFingerprintLogin && (
          <Pressable
            onPress={onFingerprintLogin}
            disabled={fingerprintLoading}
            className="flex-row items-center justify-center gap-2.5 py-3 rounded-2xl border border-border-strong disabled:opacity-60"
          >
            <FingerprintIcon color="#0E2038" />
            <Text className="text-primary text-sm font-bold">{fingerprintLoading ? t('auth.verifying') : t('auth.useFingerprint')}</Text>
          </Pressable>
        )}
      </ScrollView>

      <View className="px-[22px] pb-9 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={onLogin}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-primary items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{loading ? t('auth.loggingIn') : t('auth.loginButton')}</Text>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-center text-sm font-semibold text-text-muted">{t('auth.noAccountYet')}</Text>
          <Pressable onPress={onSwitchToSignup}>
            <Text className="text-terracotta font-extrabold text-sm">{t('auth.createAccountLink')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
