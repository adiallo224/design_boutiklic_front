import { useState } from 'react'
import { PHONE_SIGNUP_ENABLED } from '@boutiklic/shared'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, ChevronLeft, Info } from 'lucide-react-native'
import { PhoneIcon, EmailIcon } from '../../components/authIcons'
import PhoneNumberField from '../../components/PhoneNumberField'

type Channel = 'phone' | 'email'

interface CreateAccountProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  name: string
  setName: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onReceiveCode: () => void
  onSwitchToLogin: () => void
  loading?: boolean
  error?: string | null
}

export default function CreateAccount({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  name,
  setName,
  password,
  setPassword,
  onReceiveCode,
  onSwitchToLogin,
  loading = false,
  error = null,
}: CreateAccountProps) {
  const { t } = useTranslation()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit =
    !loading &&
    name.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    !passwordsMismatch &&
    (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <Pressable onPress={onSwitchToLogin} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{channel === 'phone' ? t('auth.myPhoneNumberTitle') : t('auth.myEmailTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.stepOneOfThree')}</Text>
        </View>
      </View>

      <View className="px-[22px] pb-[22px]">
        <View className="h-[5px] rounded-full bg-fond-planche flex-row gap-1">
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-fond-planche rounded-full" />
          <View className="flex-1 bg-fond-planche rounded-full" />
        </View>
      </View>

      {PHONE_SIGNUP_ENABLED && (
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
      )}

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.fullNameLabel')}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Mariama Diallo"
            className="h-[58px] rounded-2xl border border-border-strong bg-bg px-[18px] text-lg font-bold"
          />
        </View>

        {channel === 'phone' ? (
          <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={phone} setPhone={setPhone} variant="active" />
        ) : (
          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.emailAddressLabel')}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="mariama.diallo@gmail.com"
              autoCapitalize="none"
              keyboardType="email-address"
              className="h-[58px] rounded-2xl px-[18px] text-lg font-extrabold border-2 border-primary bg-bg-card"
            />
          </View>
        )}

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.passwordLabel')}</Text>
          <View className="h-[58px] rounded-2xl border border-border-strong bg-bg flex-row items-center px-[18px] gap-3">
            <TextInput
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              className="flex-1 text-lg font-extrabold tracking-[.14em]"
            />
            <Pressable onPress={() => setShowPassword((s) => !s)} disabled={password.length === 0}>
              {showPassword ? <EyeOff size={19} color="#A2A9B8" /> : <Eye size={19} color="#A2A9B8" />}
            </Pressable>
          </View>
          {password.length > 0 && password.length < 8 && <Text className="text-[13px] font-semibold text-danger">{t('auth.passwordMinLength')}</Text>}
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmPasswordLabel')}</Text>
          <View className={`h-[58px] rounded-2xl border bg-bg flex-row items-center px-[18px] gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
            <TextInput
              secureTextEntry={!showConfirmPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="••••••••"
              className="flex-1 text-lg font-extrabold tracking-[.14em]"
            />
            <Pressable onPress={() => setShowConfirmPassword((s) => !s)} disabled={confirmPassword.length === 0}>
              {showConfirmPassword ? <EyeOff size={19} color="#A2A9B8" /> : <Eye size={19} color="#A2A9B8" />}
            </Pressable>
          </View>
          {passwordsMismatch && <Text className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</Text>}
        </View>

        <View className="flex-row gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
          <Info size={18} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-relaxed text-[#33465E]">
            {t('auth.otpCodeIntro')} {channel === 'phone' ? t('auth.viaSms') : t('auth.viaEmailChannel')} {t('auth.toConfirm')}{' '}
            {channel === 'phone' ? t('auth.confirmThisNumber') : t('auth.confirmThisAddress')}
          </Text>
        </View>
      </ScrollView>

      <View className="px-[22px] pb-9 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={onReceiveCode}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-primary items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{loading ? t('auth.sendingCode') : t('auth.receiveCodeButton')}</Text>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-center text-sm font-semibold text-text-muted">{t('auth.alreadyHaveAccount')}</Text>
          <Pressable onPress={onSwitchToLogin}>
            <Text className="text-terracotta font-bold text-sm">{t('auth.loginButton')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
