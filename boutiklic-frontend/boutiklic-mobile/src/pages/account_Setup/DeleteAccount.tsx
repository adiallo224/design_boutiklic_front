import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { useTranslation } from 'react-i18next'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react-native'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'
import { clearSession } from '../../lib/session'
import { notifyAuthChanged } from '../../hooks/useAuth'

/** Suppression définitive du compte (droit à l'effacement — exigence Google Play). Confirmation par mot de passe ;
 *  en cas de succès la session locale est purgée et l'app bascule vers l'écran de connexion. */
export default function DeleteAccount({ onBack }: { onBack: () => void }) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    setError(null)
    setDeleting(true)
    try {
      await authApi.deleteAccount(password)
      await clearSession()
      notifyAuthChanged()
    } catch (e) {
      setError(toErrorMessage(e))
      setDeleting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg-card">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} disabled={deleting} className="w-10 h-10 rounded-xl border border-border-strong items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.deleteAccountTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16, paddingTop: 4, paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        <Text className="p-3.5 rounded-2xl bg-info-bg border border-info-border text-[13px] leading-relaxed text-[#33465E]">
          {t('auth.deleteAccountExplainer')}
        </Text>
        <Text className="text-[13px] leading-relaxed text-text-dim">{t('auth.deleteAccountKept')}</Text>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.currentPasswordLabel')}</Text>
          <View className="h-[56px] rounded-2xl border border-border-strong bg-bg flex-row items-center px-[18px] gap-3">
            <TextInput
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              className="flex-1 text-base font-semibold"
            />
            <Pressable onPress={() => setShowPassword((s) => !s)} disabled={password.length === 0}>
              {showPassword ? <EyeOff size={19} color="#A2A9B8" /> : <Eye size={19} color="#A2A9B8" />}
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <View className="px-5 pb-5 gap-3.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={handleDelete}
          disabled={deleting || password.length === 0}
          className="h-[58px] rounded-[18px] bg-danger items-center justify-center active:scale-95 disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{deleting ? t('auth.deleteAccountDeleting') : t('auth.deleteAccountConfirm')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
