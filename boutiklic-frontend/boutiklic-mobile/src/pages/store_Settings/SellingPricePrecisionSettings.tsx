import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { ChevronLeft, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { Tenant } from '../../hooks/useTenant'
import { productsApi } from '../../lib/productsApi'
import { toErrorMessage } from '../../lib/apiClient'

interface SellingPricePrecisionSettingsProps {
  onBack: () => void
  tenant: Tenant
  /** Modifier ce réglage est réservé au propriétaire, cf. ProductController (PATCH hasRole('OWNER')). */
  isOwner: boolean
  onSaved: () => void
}

/**
 * Précision des prix de vente unitaires (0 à 2 décimales, étude prix décimaux phase 5bis) — réglage propriétaire distinct de la
 * devise, qui reste figée. Repasser à moins de décimales est refusé par le serveur (409) tant que des articles actifs ont un prix
 * plus précis : le message d'erreur (dans la langue de l'utilisateur) donne leur nombre.
 */
export default function SellingPricePrecisionSettings({ onBack, tenant, isOwner, onSaved }: SellingPricePrecisionSettingsProps) {
  const { t } = useTranslation()
  const [decimals, setDecimals] = useState(tenant.sellingPriceDecimals)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const changed = decimals !== tenant.sellingPriceDecimals

  const handleSave = async () => {
    if (!changed) return
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await productsApi.changeSellingPriceDecimals(decimals)
      onSaved()
      setSaved(true)
    } catch (err) {
      setError(toErrorMessage(err))
      setDecimals(tenant.sellingPriceDecimals)
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
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.sellingPriceDecimalsTitle')}</Text>
      </View>

      <View className="flex-1 px-5 pb-4 gap-3.5">
        <Text className="text-sm leading-relaxed text-text-muted">{t('settings.sellingPriceDecimalsHelp')}</Text>

        {!isOwner && (
          <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.ownerOnlyEditSetting')}</Text>
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.sellingPriceDecimalsFieldLabel')}</Text>
          {[0, 1, 2].map((n) => (
            <Pressable
              key={n}
              onPress={() => isOwner && setDecimals(n)}
              disabled={!isOwner}
              accessibilityRole="radio"
              accessibilityState={{ checked: decimals === n, disabled: !isOwner }}
              className={`flex-row items-center gap-3 h-[52px] px-4 rounded-xl border ${decimals === n ? 'border-primary bg-bg' : 'border-border-strong bg-bg'} ${isOwner ? '' : 'opacity-60'}`}
            >
              <View className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${decimals === n ? 'bg-primary border-primary' : 'border-border-strong'}`}>
                {decimals === n && <Check size={13} color="#FFFDFA" />}
              </View>
              <Text className="flex-1 text-[15px] font-semibold">{t(`settings.sellingPriceDecimalsOption${n}`)}</Text>
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
