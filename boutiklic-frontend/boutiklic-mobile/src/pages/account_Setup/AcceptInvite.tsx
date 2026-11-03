import { useState } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Eye, EyeOff, UserCheck, CircleCheck } from 'lucide-react-native'

const ROLE_KEYS: Record<string, string> = {
  SELLER: 'settings.role.seller',
  APPRENTICE: 'settings.role.apprentice',
  SUPERVISOR: 'settings.role.supervisor',
  OWNER: 'settings.role.owner',
}

interface AcceptInviteProps {
  boutiqueName: string | null
  logoUrl: string | null
  role: string
  name: string
  setName: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onActivate: () => void
  onChangeNumber: () => void
  loading?: boolean
  error?: string | null
}

/** Écran A3e — Activer mon compte (invité reconnu) : dernière étape, pas de création de boutique.
 *  Atteint depuis AuthFlow.handleConfirmOtp quand l'OTP vérifié correspond à un membre
 *  PENDING_ACTIVATION (credentialAlreadySet: false). */
export default function AcceptInvite({
  boutiqueName,
  logoUrl,
  role,
  name,
  setName,
  password,
  setPassword,
  onActivate,
  onChangeNumber,
  loading = false,
  error = null,
}: AcceptInviteProps) {
  const { t } = useTranslation()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function passwordStrength(password: string): { label: string; segments: 0 | 1 | 2 } | null {
    if (password.length === 0) return null
    if (password.length < 8) return { label: t('auth.passwordStrengthTooShort'), segments: 0 }
    const varied = /[A-Z]/.test(password) && /[0-9]/.test(password)
    return varied ? { label: t('auth.passwordStrengthGood'), segments: 2 } : { label: t('auth.passwordStrengthWeak'), segments: 1 }
  }

  const strength = passwordStrength(password)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !loading && name.trim().length > 0 && password.length >= 8 && confirmPassword.length > 0 && !passwordsMismatch
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <View className="w-11 h-11 rounded-2xl bg-success items-center justify-center">
          <UserCheck size={21} color="#FFFDFA" strokeWidth={2.4} />
        </View>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.activateAccountTitle')}</Text>
          <Text className="text-[13px] font-extrabold text-success">{t('auth.invitationRecognized')}</Text>
        </View>
      </View>

      <View className="px-[22px] pb-[22px]">
        <View className="h-1 rounded-full bg-fond-planche">
          <View className="h-1 rounded-full bg-success" style={{ width: '100%' }} />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 16, paddingTop: 4 }} showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-[#F7EFE3] border border-border-strong">
          {logoUrl ? (
            <Image source={{ uri: logoUrl }} className="w-[46px] h-[46px] rounded-[14px]" />
          ) : (
            <View className="w-[46px] h-[46px] rounded-[14px] bg-primary items-center justify-center">
              <View className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#FFFDFA', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
            </View>
          )}
          <View className="flex-1 gap-0.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.youAreJoining')}</Text>
            <Text className="text-[17px] font-extrabold tracking-tight" numberOfLines={1}>
              {boutiqueName ?? t('common.loading')}
            </Text>
          </View>
          <View className="px-3 py-1.5 rounded-full bg-info-bg">
            <Text className="text-primary text-[13px] font-bold">{ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}</Text>
          </View>
        </View>

        <View className="p-4 rounded-[22px] bg-papier border border-border-strong gap-4">
          <Text className="text-[13px] leading-relaxed text-text-muted">
            {t('auth.acceptInviteExplainer')}
          </Text>

          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.yourNameLabel')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Aissatou Baldé"
              className="h-[58px] rounded-2xl border-2 border-success bg-bg px-[18px] text-lg font-bold"
            />
          </View>

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
            {strength && (
              <View className="flex-row items-center gap-2">
                <View className="flex-1 flex-row gap-1">
                  {[0, 1].map((i) => (
                    <View key={i} className={`flex-1 h-[5px] rounded-full ${i < strength.segments ? 'bg-success' : 'bg-fond-planche'}`} />
                  ))}
                </View>
                <Text className={`text-[12px] font-bold ${strength.segments === 2 ? 'text-success' : 'text-text-dim'}`}>{strength.label}</Text>
              </View>
            )}
          </View>

          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmPasswordLabel')}</Text>
            <View className={`h-[58px] rounded-2xl border bg-bg flex-row items-center px-[18px] gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
              <TextInput
                secureTextEntry={!showConfirmPassword}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t('auth.repeatPasswordPlaceholder')}
                className="flex-1 text-lg font-extrabold tracking-[.14em]"
              />
              <Pressable onPress={() => setShowConfirmPassword((s) => !s)} disabled={confirmPassword.length === 0}>
                {showConfirmPassword ? <EyeOff size={19} color="#A2A9B8" /> : <Eye size={19} color="#A2A9B8" />}
              </Pressable>
            </View>
            {passwordsMismatch && <Text className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</Text>}
          </View>
        </View>

        <View className="flex-row gap-2.5 p-3.5 rounded-2xl bg-succes-bg border border-[#CBE1D7]">
          <CircleCheck size={18} color="#1F5C43" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-[13px] leading-relaxed text-succes-text">{t('auth.joiningExistingShopNotice')}</Text>
        </View>
      </ScrollView>

      <View className="px-[22px] pb-5 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={onActivate}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-success items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{loading ? t('auth.activating') : `${t('auth.activateAccountButton')} →`}</Text>
        </Pressable>
        <View className="flex-row items-center justify-center gap-1">
          <Text className="text-center text-sm font-semibold text-text-muted">{t('auth.notYouQuestion')}</Text>
          <Pressable onPress={onChangeNumber}>
            <Text className="text-terracotta font-bold text-sm">{t('auth.changeNumberLink')}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}
