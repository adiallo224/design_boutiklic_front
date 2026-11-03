import { useState } from 'react'
import { View, Text, Pressable, TextInput } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { Tenant } from '../../hooks/useTenant'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'

interface DiscountThresholdSettingsProps {
  onBack: () => void
  tenant: Tenant
  /** Modifier ce réglage est réservé au propriétaire, cf. TenantController (PATCH hasRole('OWNER')). */
  isOwner: boolean
  onSaved: () => void
}

export default function DiscountThresholdSettings({ onBack, tenant, isOwner, onSaved }: DiscountThresholdSettingsProps) {
  const { t } = useTranslation()
  const [threshold, setThreshold] = useState(String(tenant.discountApprovalThresholdPercent))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const parsedThreshold = Number(threshold)
  const isValid = threshold !== '' && parsedThreshold >= 0 && parsedThreshold <= 100

  const handleSave = async () => {
    if (!isValid) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await authApi.changeDiscountThreshold(tenant.id, parsedThreshold)
      onSaved()
      setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.discountThreshold')}</Text>
      </View>

      <View className="flex-1 px-5 pb-4 gap-3.5">
        <Text className="text-sm leading-relaxed text-text-muted">
          {t('settings.discountThresholdDescription')}
        </Text>

        {!isOwner && (
          <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.ownerOnlyEditSetting')}</Text>
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.thresholdFieldLabel')}</Text>
          <TextInput
            keyboardType="number-pad"
            value={threshold}
            onChangeText={setThreshold}
            editable={isOwner}
            className={`amount h-[54px] rounded-xl border border-border-strong px-4 font-extrabold ${isOwner ? 'bg-bg' : 'bg-bg-elevated text-text-muted'}`}
          />
        </View>

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        {saved && !error && <Text className="text-[13px] font-semibold text-success text-center">{t('settings.changesSaved')}</Text>}
        {isOwner && (
          <Pressable onPress={handleSave} disabled={saving || !isValid} className="w-full bg-primary py-4 rounded-2xl items-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{saving ? t('settings.saving') : t('settings.saveChanges')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
