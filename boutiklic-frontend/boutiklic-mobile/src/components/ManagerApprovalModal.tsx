import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Modal } from 'react-native'
import { Lock } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

interface ManagerApprovalModalProps {
  open: boolean
  loading: boolean
  error: string | null
  onSubmit: (password: string) => void
  onCancel: () => void
}

/** Modale de relais gérant (écran B3) — mirror RN de ManagerApprovalModal côté web, cf.
 * components/PeriodDropdown.tsx pour le pattern Modal transparent déjà établi dans ce repo.
 * Demande le mot de passe du propriétaire quand un rabais dépasse le seuil autorisé pour le
 * vendeur qui l'accorde. */
export default function ManagerApprovalModal({ open, loading, error, onSubmit, onCancel }: ManagerApprovalModalProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) setPassword('')
  }, [open])

  const handleSubmit = () => {
    if (password && !loading) onSubmit(password)
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={{ flex: 1 }} className="bg-black/40 items-center justify-center px-5" onPress={onCancel}>
        <Pressable onPress={(e) => e.stopPropagation()} className="w-full rounded-[20px] bg-bg-card border border-border-strong p-5 gap-3.5">
          <View className="flex-row items-center gap-2.5">
            <View className="w-10 h-10 rounded-xl bg-alerte-bg items-center justify-center">
              <Lock size={18} color="#9A7318" />
            </View>
            <View className="gap-0.5">
              <Text className="text-[15px] font-extrabold">{t('components.managerApproval.title')}</Text>
              <Text className="text-[13px] font-semibold text-text-dim">{t('components.managerApproval.subtitle')}</Text>
            </View>
          </View>

          <TextInput
            autoFocus
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={handleSubmit}
            placeholder={t('components.managerApproval.passwordPlaceholder')}
            className="h-12 px-4 rounded-xl border border-border-strong bg-bg text-[15px] font-semibold"
          />
          {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

          <View className="flex-row gap-2.5">
            <Pressable onPress={onCancel} className="flex-1 h-12 rounded-xl border border-border-strong bg-bg items-center justify-center">
              <Text className="text-[15px] font-bold">{t('components.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={handleSubmit}
              disabled={!password || loading}
              className="flex-1 h-12 rounded-xl bg-primary items-center justify-center disabled:opacity-40"
            >
              <Text className="text-papier text-[15px] font-extrabold">{loading ? '...' : t('components.confirm')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}
