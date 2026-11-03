import { useState } from 'react'
import { View, Text, TextInput, Pressable, Modal } from 'react-native'
import { useTranslation } from 'react-i18next'
import { userApi } from '../lib/userApi'
import { toErrorMessage } from '../lib/apiClient'

interface LockScreenProps {
  visible: boolean
  onUnlock: () => void
}

/** Écran de verrouillage auto plein écran (Sécurité, A4) — déclenché par useIdleTimer, monté dans
 * app/_layout.tsx pour couvrir toute la app authentifiée quel que soit l'onglet actif. */
export default function LockScreen({ visible, onUnlock }: LockScreenProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleUnlock = async () => {
    if (!password || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await userApi.verifyPassword(password)
      setPassword('')
      onUnlock()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={() => {}}>
      <View className="flex-1 bg-encre items-center justify-center px-6 gap-5">
        <View className="w-16 h-16 rounded-full bg-papier/10 items-center justify-center">
          <Text className="text-3xl">🔒</Text>
        </View>
        <Text className="text-papier text-lg font-extrabold">{t('components.lockScreen.title')}</Text>
        <View className="w-full max-w-xs gap-3">
          <TextInput
            autoFocus
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleUnlock}
            placeholder={t('components.lockScreen.passwordPlaceholder')}
            placeholderTextColor="rgba(255,253,250,0.5)"
            className="h-12 px-4 rounded-xl bg-papier/10 border border-papier/20 text-papier font-semibold"
          />
          {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
          <Pressable onPress={handleUnlock} disabled={!password || submitting} className="h-12 rounded-xl bg-primary items-center justify-center disabled:opacity-40">
            <Text className="text-papier font-extrabold">{submitting ? '...' : t('components.lockScreen.unlock')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  )
}
