import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronLeft, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { COST_METHODS, type CostMethod } from '@boutiklic/shared'
import type { Tenant } from '../../hooks/useTenant'
import { authApi } from '../../lib/authApi'
import { toErrorMessage } from '../../lib/apiClient'

interface CostMethodSettingsProps {
  onBack: () => void
  tenant: Tenant
  /** Modifier ce réglage est réservé au propriétaire, cf. TenantController (PATCH hasRole('OWNER')). */
  isOwner: boolean
  onSaved: () => void
}

/**
 * Méthode de coût (étude prix décimaux, section 11) : ce qu'un arrivage de stock fait au coût d'achat des articles, donc à la marge.
 * Réglage propriétaire. Ne modifie aucun coût existant ni aucune vente passée : seuls les arrivages enregistrés ensuite sont concernés.
 */
export default function CostMethodSettings({ onBack, tenant, isOwner, onSaved }: CostMethodSettingsProps) {
  const { t } = useTranslation()
  const [method, setMethod] = useState<CostMethod>(tenant.costMethod)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const changed = method !== tenant.costMethod

  const handleSave = async () => {
    if (!changed) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await authApi.changeCostMethod(tenant.id, method)
      onSaved()
      setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
      setMethod(tenant.costMethod)
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
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.costMethodTitle')}</Text>
      </View>

      <View className="flex-1 px-5 pb-4 gap-3.5">
        <Text className="text-sm leading-relaxed text-text-muted">{t('settings.costMethodHelp')}</Text>

        {!isOwner && (
          <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.ownerOnlyEditSetting')}</Text>
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.costMethodFieldLabel')}</Text>
          {COST_METHODS.map((m) => (
            <Pressable
              key={m}
              onPress={() => isOwner && setMethod(m)}
              disabled={!isOwner}
              accessibilityRole="radio"
              accessibilityState={{ checked: method === m, disabled: !isOwner }}
              className={`flex-row items-center gap-3 px-4 py-3 rounded-xl border ${method === m ? 'border-primary bg-bg' : 'border-border-strong bg-bg'} ${isOwner ? '' : 'opacity-60'}`}
            >
              <View className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${method === m ? 'bg-primary border-primary' : 'border-border-strong'}`}>
                {method === m && <Check size={13} color="#FFFDFA" />}
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-semibold">{t(`settings.costMethodOption.${m}`)}</Text>
                <Text className="text-[12px] leading-snug text-text-muted">{t(`settings.costMethodDescription.${m}`)}</Text>
              </View>
            </Pressable>
          ))}
        </View>

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        {saved && !error && <Text className="text-[13px] font-semibold text-success text-center">{t('settings.changesSaved')}</Text>}
        {isOwner && (
          <Pressable onPress={handleSave} disabled={saving || !changed} className="w-full bg-primary py-4 rounded-2xl items-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{saving ? t('settings.saving') : t('settings.saveChanges')}</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}
