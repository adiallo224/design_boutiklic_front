import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'

interface RecoveryPinSetupProps {
  /** Un code est-il déjà configuré ? Affiche l'option de désactivation seulement dans ce cas. */
  configured: boolean
  onBack: () => void
  /** `stillConfigured` reflète le nouvel état (true après configuration, false après désactivation)
   *  pour que Security.tsx mette à jour son badge sans refaire un appel réseau. */
  onDone: (stillConfigured: boolean) => void
}

/** Écran plein (et non un accordéon inline, cf. Security.tsx) — même structure que ResetPassword.tsx
 *  pour garder le même comportement de scroll éprouvé. */
export default function RecoveryPinSetup({ configured, onBack, onDone }: RecoveryPinSetupProps) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<'set' | 'disable'>('set')
  const [currentPassword, setCurrentPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const isDisabling = mode === 'disable'
  const pinsMismatch = confirmPin.length > 0 && newPin !== confirmPin
  const canSubmit = isDisabling
    ? !saving && currentPassword.length > 0
    : !saving && currentPassword.length > 0 && newPin.length === 6 && confirmPin.length === 6 && !pinsMismatch

  const handleSubmit = async () => {
    setError(null)
    setSaving(true)
    try {
      if (isDisabling) {
        await authApi.disableRecoveryPin(currentPassword)
        onDone(false)
      } else {
        await authApi.setRecoveryPin(currentPassword, newPin)
        onDone(true)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-bg-card">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{isDisabling ? t('auth.disableCodeTitle') : t('auth.recoveryCodeTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.recoveryCodeSecuritySubtitle')}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingTop: 4, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Text className="p-3.5 rounded-2xl bg-info-bg border border-info-border text-[13px] leading-relaxed text-[#33465E]">
          {isDisabling ? t('auth.disableRecoveryExplainer') : t('auth.setupRecoveryExplainer')}
        </Text>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.currentPasswordLabel')}</Text>
          <View className="h-[56px] rounded-2xl border border-border-strong bg-bg flex-row items-center px-[18px] gap-3">
            <TextInput
              secureTextEntry={!showPassword}
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••••"
              className="flex-1 text-base font-semibold"
            />
            <Pressable onPress={() => setShowPassword((s) => !s)} disabled={currentPassword.length === 0}>
              {showPassword ? <EyeOff size={19} color="#A2A9B8" /> : <Eye size={19} color="#A2A9B8" />}
            </Pressable>
          </View>
        </View>

        {!isDisabling && (
          <>
            <View className="gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.newCodeLabel')}</Text>
              <TextInput
                value={newPin}
                onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                keyboardType="number-pad"
                secureTextEntry
                className="amount h-[56px] rounded-2xl border border-border-strong bg-bg px-[18px] text-lg font-extrabold tracking-[.3em]"
              />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmCodeLabel')}</Text>
              <TextInput
                value={confirmPin}
                onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                keyboardType="number-pad"
                secureTextEntry
                className={`amount h-[56px] rounded-2xl border bg-bg px-[18px] text-lg font-extrabold tracking-[.3em] ${
                  pinsMismatch ? 'border-danger' : 'border-border-strong'
                }`}
              />
              {pinsMismatch && <Text className="text-[13px] font-semibold text-danger">{t('auth.codesMismatch')}</Text>}
            </View>
          </>
        )}

        {configured && (
          <Pressable
            onPress={() => {
              setError(null)
              setMode((m) => (m === 'disable' ? 'set' : 'disable'))
            }}
          >
            <Text className="text-[13px] font-bold text-terracotta">
              {isDisabling ? t('auth.switchToSetupNew') : t('auth.disableRecoveryCode')}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <View className="px-5 pb-5 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit}
          className={`h-[58px] rounded-[18px] items-center justify-center active:scale-95 disabled:opacity-50 ${isDisabling ? 'bg-danger' : 'bg-primary'}`}
        >
          <Text className="text-papier text-lg font-extrabold">{saving ? t('auth.saving') : isDisabling ? t('auth.disable') : t('auth.save')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
