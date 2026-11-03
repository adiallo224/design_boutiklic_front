import { useState } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView } from 'react-native'
import { ChevronLeft, ChevronRight, Store } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import type { Tenant } from '../../hooks/useTenant'
import { authApi } from '../../lib/authApi'
import { fileApi } from '../../lib/fileApi'
import { toErrorMessage } from '../../lib/apiClient'
import SelectField from '../../components/SelectField'

interface ShopProfileProps {
  onBack: () => void
  tenant: Tenant
  formatCurrency: (n: number) => string
  tenantsCount: number
  /** Modifier le profil boutique est réservé au propriétaire, cf. TenantController (PATCH hasRole('OWNER')). */
  isOwner: boolean
  onOpenSwitchShop: () => void
  onSaved: () => void
}

/** Devise sans lien 1:1 avec un pays (FCFA est partagé par plusieurs pays) — cf. packages/shared/countries.ts. */
const CURRENCY_INFO: Record<string, { flag: string; labelKey: string }> = {
  GNF: { flag: '🇬🇳', labelKey: 'common.currency.gnf' },
  FCFA: { flag: '🌍', labelKey: 'common.currency.fcfa' },
  SLE: { flag: '🇸🇱', labelKey: 'common.currency.sle' },
  LRD: { flag: '🇱🇷', labelKey: 'common.currency.lrd' },
  GHS: { flag: '🇬🇭', labelKey: 'common.currency.ghs' },
  NGN: { flag: '🇳🇬', labelKey: 'common.currency.ngn' },
  GMD: { flag: '🇬🇲', labelKey: 'common.currency.gmd' },
  CVE: { flag: '🇨🇻', labelKey: 'common.currency.cve' },
  DZD: { flag: '🇩🇿', labelKey: 'common.currency.dzd' },
  AOA: { flag: '🇦🇴', labelKey: 'common.currency.aoa' },
  BWP: { flag: '🇧🇼', labelKey: 'common.currency.bwp' },
  BIF: { flag: '🇧🇮', labelKey: 'common.currency.bif' },
  KMF: { flag: '🇰🇲', labelKey: 'common.currency.kmf' },
  CDF: { flag: '🇨🇩', labelKey: 'common.currency.cdf' },
  DJF: { flag: '🇩🇯', labelKey: 'common.currency.djf' },
  EGP: { flag: '🇪🇬', labelKey: 'common.currency.egp' },
  ERN: { flag: '🇪🇷', labelKey: 'common.currency.ern' },
  SZL: { flag: '🇸🇿', labelKey: 'common.currency.szl' },
  ETB: { flag: '🇪🇹', labelKey: 'common.currency.etb' },
  KES: { flag: '🇰🇪', labelKey: 'common.currency.kes' },
  LSL: { flag: '🇱🇸', labelKey: 'common.currency.lsl' },
  LYD: { flag: '🇱🇾', labelKey: 'common.currency.lyd' },
  MGA: { flag: '🇲🇬', labelKey: 'common.currency.mga' },
  MWK: { flag: '🇲🇼', labelKey: 'common.currency.mwk' },
  MUR: { flag: '🇲🇺', labelKey: 'common.currency.mur' },
  MRU: { flag: '🇲🇷', labelKey: 'common.currency.mru' },
  MAD: { flag: '🇲🇦', labelKey: 'common.currency.mad' },
  MZN: { flag: '🇲🇿', labelKey: 'common.currency.mzn' },
  NAD: { flag: '🇳🇦', labelKey: 'common.currency.nad' },
  UGX: { flag: '🇺🇬', labelKey: 'common.currency.ugx' },
  RWF: { flag: '🇷🇼', labelKey: 'common.currency.rwf' },
  STN: { flag: '🇸🇹', labelKey: 'common.currency.stn' },
  SCR: { flag: '🇸🇨', labelKey: 'common.currency.scr' },
  SOS: { flag: '🇸🇴', labelKey: 'common.currency.sos' },
  SDG: { flag: '🇸🇩', labelKey: 'common.currency.sdg' },
  SSP: { flag: '🇸🇸', labelKey: 'common.currency.ssp' },
  ZAR: { flag: '🇿🇦', labelKey: 'common.currency.zar' },
  TZS: { flag: '🇹🇿', labelKey: 'common.currency.tzs' },
  TND: { flag: '🇹🇳', labelKey: 'common.currency.tnd' },
  ZMW: { flag: '🇿🇲', labelKey: 'common.currency.zmw' },
  ZWG: { flag: '🇿🇼', labelKey: 'common.currency.zwg' },
}

export default function ShopProfile({ onBack, tenant, formatCurrency, tenantsCount, isOwner, onOpenSwitchShop, onSaved }: ShopProfileProps) {
  const { t } = useTranslation()
  const SHOP_SIZE_LABELS: Record<Tenant['shopSize'], string> = {
    PETITE: t('settings.shopSize.small'),
    MOYENNE: t('settings.shopSize.medium'),
    GRANDE: t('settings.shopSize.large'),
  }
  const currencyInfo = CURRENCY_INFO[tenant.currency] ?? { flag: '🌍', labelKey: '' }
  const [shopName, setShopName] = useState(tenant.name)
  const [city, setCity] = useState(tenant.city)
  const [shopSize, setShopSize] = useState(tenant.shopSize)
  const [logoUrl, setLogoUrl] = useState(tenant.logoUrl)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const handlePickLogo = async () => {
    if (!isOwner) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] })
    if (result.canceled) return
    const asset = result.assets[0]
    setUploadingLogo(true)
    setError(null)
    try {
      const { url } = await fileApi.upload({ uri: asset.uri, name: asset.fileName ?? 'logo.jpg', type: asset.mimeType ?? 'image/jpeg' })
      setLogoUrl(url)
    } catch (err) {
      setError(toErrorMessage(err))
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await authApi.updateTenantIdentity(tenant.id, {
        name: shopName,
        city,
        neighborhood: tenant.neighborhood ?? undefined,
        logoUrl: logoUrl ?? undefined,
      })
      if (shopSize !== tenant.shopSize) {
        await authApi.changeShopSize(tenant.id, shopSize)
      }
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
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.shopProfileTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View className="items-center py-2 gap-2">
          <Pressable onPress={handlePickLogo} disabled={!isOwner || uploadingLogo} className="w-20 h-20 rounded-full bg-info-bg items-center justify-center overflow-hidden">
            {logoUrl ? <Image source={{ uri: logoUrl }} className="w-full h-full" /> : <Text className="text-4xl">🏪</Text>}
          </Pressable>
          {isOwner && (
            <Pressable onPress={handlePickLogo} disabled={uploadingLogo}>
              <Text className="text-primary text-sm font-bold" style={{ opacity: uploadingLogo ? 0.5 : 1 }}>
                {uploadingLogo ? t('settings.uploading') : t('settings.changeLogo')}
              </Text>
            </Pressable>
          )}
        </View>

        {!isOwner && (
          <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.ownerOnlyEditProfile')}</Text>
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-3.5">
          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopNameLabel')}</Text>
            <TextInput
              value={shopName}
              onChangeText={setShopName}
              editable={isOwner}
              className={`h-[52px] rounded-xl border border-border-strong px-4 font-bold ${isOwner ? 'bg-bg' : 'bg-bg-elevated text-text-muted'}`}
            />
          </View>
          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.cityLabel')}</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              editable={isOwner}
              className={`h-[52px] rounded-xl border border-border-strong px-4 font-bold ${isOwner ? 'bg-bg' : 'bg-bg-elevated text-text-muted'}`}
            />
          </View>
          <View className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.currencyLabel')}</Text>
              <Text className="text-[11px] font-semibold text-text-dim">{t('settings.currencyFixedAtCreation')}</Text>
            </View>
            <View className="h-[52px] rounded-xl border border-border-strong bg-bg-elevated px-4 justify-center">
              <Text className="font-bold text-text-muted">
                {currencyInfo.flag} {currencyInfo.labelKey ? t(currencyInfo.labelKey) : ''} · {tenant.currency}
              </Text>
            </View>
          </View>
          <View className="gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopSizeLabel')}</Text>
            <SelectField
              value={shopSize}
              onChange={(v) => setShopSize(v as Tenant['shopSize'])}
              options={(['PETITE', 'MOYENNE', 'GRANDE'] as const).map((size) => ({ label: SHOP_SIZE_LABELS[size], value: size }))}
              disabled={!isOwner}
            />
          </View>
        </View>

        <Pressable onPress={onOpenSwitchShop} className="w-full bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5 active:scale-[0.98]">
          <View className="w-10 h-10 rounded-xl bg-bg-elevated items-center justify-center">
            <Store size={19} color="#111418" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold">{t('settings.switchShop')}</Text>
            <Text className="text-[13px] text-text-dim font-semibold">
              {t('settings.shopsCountActive', { count: tenantsCount, name: tenant.name })}
            </Text>
          </View>
          <ChevronRight size={18} color="#A2A9B8" />
        </Pressable>

        <View className="bg-bg-card rounded-2xl border border-border p-4">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-extrabold">{t('settings.subscription')}</Text>
            <View className={`px-2 py-0.5 rounded-full ${tenant.subscription === 'PREMIUM' ? 'bg-info-bg' : 'bg-bg-elevated'}`}>
              <Text className={`text-xs font-extrabold ${tenant.subscription === 'PREMIUM' ? 'text-primary' : 'text-text-muted'}`}>
                {tenant.subscription === 'PREMIUM' ? t('settings.subscriptionPremium') : t('settings.subscriptionFree')}
              </Text>
            </View>
          </View>
          <Text className="text-text-muted text-xs font-semibold mb-3">
            {tenant.subscription === 'GRATUIT' ? t('settings.freeVersionDescription', { amount: formatCurrency(0) }) : t('settings.unlimitedAccess')}
          </Text>
          {tenant.subscription === 'GRATUIT' && (
            <Pressable className="w-full bg-primary py-3 rounded-xl items-center active:scale-95">
              <Text className="text-papier font-extrabold">{t('settings.upgradeToPremium')}</Text>
            </Pressable>
          )}
        </View>

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        {saved && !error && <Text className="text-[13px] font-semibold text-success text-center">{t('settings.changesSaved')}</Text>}
        {isOwner && (
          <Pressable onPress={handleSave} disabled={saving || shopName.trim().length === 0 || city.trim().length === 0} className="w-full bg-primary py-4 rounded-2xl items-center active:scale-95 disabled:opacity-50">
            <Text className="text-papier font-extrabold">{saving ? t('settings.saving') : t('settings.saveChanges')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}
