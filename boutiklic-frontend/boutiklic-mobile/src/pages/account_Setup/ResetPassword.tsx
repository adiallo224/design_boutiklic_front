import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native'

interface ResetPasswordProps {
  onSubmit: (password: string) => void
  onBack: () => void
  loading?: boolean
  error?: string | null
}

export default function ResetPassword({ onSubmit, onBack, loading = false, error = null }: ResetPasswordProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !loading && password.length >= 8 && confirmPassword.length > 0 && !passwordsMismatch
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.newPasswordTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.resetLastStep')}</Text>
        </View>
      </View>

      <View className="px-[22px] pb-[22px]">
        <View className="h-1 rounded-full bg-fond-planche">
          <View className="h-1 rounded-full bg-primary" style={{ width: '100%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.newPasswordLabel')}</Text>
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
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmNewPasswordLabel')}</Text>
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
      </ScrollView>

      <View className="px-[22px] pb-5 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={() => canSubmit && onSubmit(password)}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-primary items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{loading ? t('auth.saving') : t('auth.validate')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
