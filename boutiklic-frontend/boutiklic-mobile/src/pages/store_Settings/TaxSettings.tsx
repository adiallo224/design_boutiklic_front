import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView, Switch, TextInput } from 'react-native'
import { ChevronLeft, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { COUNTRIES } from '@boutiklic/shared'
import type { Tenant } from '../../hooks/useTenant'
import { taxApi, type CountryRates, type TaxCategoryResponse } from '../../lib/taxApi'
import { authApi } from '../../lib/authApi'
import SelectField from '../../components/SelectField'
import { formatTaxRate } from '../../lib/taxInheritance'
import { toErrorMessage } from '../../lib/apiClient'

interface TaxSettingsProps {
  onBack: () => void
  tenant: Tenant
  /** Activer la TVA et gérer les taux est réservé au propriétaire, cf. TaxCategoryController (hasRole('OWNER')). */
  isOwner: boolean
  /** Recharge la boutique après un changement (l'interrupteur et le défaut vivent sur le tenant). */
  onSaved: () => void
}

const parseRate = (raw: string) => {
  const value = Number(raw.replace(',', '.'))
  return raw.trim() !== '' && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null
}

/**
 * Fiscalité de la boutique : interrupteur TVA, taux disponibles et taux par défaut — dernier étage de la cascade
 * article > catégorie > boutique. Les prix de vente sont TTC : la TVA est extraite du prix, elle ne s'y ajoute pas.
 * Chaque action s'enregistre aussitôt.
 */
export default function TaxSettings({ onBack, tenant, isOwner, onSaved }: TaxSettingsProps) {
  const { t } = useTranslation()
  const [categories, setCategories] = useState<TaxCategoryResponse[]>([])
  const [countryRates, setCountryRates] = useState<CountryRates | null>(null)
  const [defaultId, setDefaultId] = useState(tenant.defaultTaxCategoryId ?? '')
  const [newName, setNewName] = useState('')
  const [newRate, setNewRate] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingRate, setEditingRate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [loadedCategories, loadedRates] = await Promise.all([taxApi.getActiveCategories(), taxApi.getCountryRates()])
      setCategories(loadedCategories)
      setCountryRates(loadedRates)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [])
  // Le pays pilote les taux officiels proposés : on relit quand il change.
  useEffect(() => { load() }, [load, tenant.country])
  useEffect(() => { setDefaultId(tenant.defaultTaxCategoryId ?? '') }, [tenant.defaultTaxCategoryId])

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true)
    setError(null)
    try {
      await action()
      await load()
      onSaved()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const newRateValue = parseRate(newRate)
  const editingRateValue = parseRate(editingRate)
  const canEnable = categories.length > 0 && (defaultId !== '' || tenant.taxEnabled)

  const changeCountry = (country: string) => country && run(() => authApi.changeCountry(tenant.id, country))
  const importRate = (code: string) => run(() => taxApi.importCountryRate(code))
  const followOfficial = (id: string) => run(() => taxApi.followOfficialRate(id))

  const toggle = () => run(() => taxApi.configure(!tenant.taxEnabled, defaultId || undefined))
  const changeDefault = (id: string) => {
    setDefaultId(id)
    // Activée : le nouveau défaut s'applique tout de suite. Désactivée : il est retenu pour l'activation.
    if (tenant.taxEnabled) run(() => taxApi.configure(true, id))
  }
  const addRate = async () => {
    if (newRateValue === null || newName.trim() === '') return
    await run(async () => {
      const created = await taxApi.create({ name: newName.trim(), ratePercent: newRateValue })
      if (!defaultId) setDefaultId(created.id)
    })
    setNewName('')
    setNewRate('')
  }
  const saveRate = async (id: string) => {
    if (editingRateValue === null) return
    await run(() => taxApi.changeRate(id, editingRateValue))
    setEditingId(null)
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.taxTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 14, paddingBottom: 24 }} keyboardShouldPersistTaps="handled">
        <Text className="text-sm leading-relaxed text-text-muted">{t('settings.taxHint')}</Text>

        {!isOwner && (
          <View className="p-3.5 rounded-2xl bg-info-bg border border-info-border">
            <Text className="text-[13px] leading-relaxed text-[#33465E]">{t('settings.ownerOnlyEditSetting')}</Text>
          </View>
        )}

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
          <View className="flex-row items-center gap-3">
            <View className="flex-1 gap-0.5">
              <Text className="text-[15px] font-semibold">{t('settings.taxEnabledLabel')}</Text>
              <Text className="text-[12px] text-text-muted">{tenant.taxEnabled ? t('settings.taxEnabledOn') : t('settings.taxEnabledOff')}</Text>
            </View>
            <Switch
              value={tenant.taxEnabled}
              onValueChange={toggle}
              disabled={!isOwner || busy || (!tenant.taxEnabled && !canEnable)}
              trackColor={{ false: '#D5D9E0', true: '#1E3A5F' }}
            />
          </View>
          {!tenant.taxEnabled && !canEnable && <Text className="text-[12px] text-text-muted">{t('settings.taxNeedRate')}</Text>}
          <Text className="text-[12px] leading-snug text-text-muted">{t('settings.taxZeroHint')}</Text>
        </View>

        <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.taxCountryLabel')}</Text>
          <SelectField
            value={tenant.country ?? ''}
            onChange={changeCountry}
            options={COUNTRIES.map((c) => ({ label: c.name, value: c.id }))}
            placeholder={t('settings.taxCountryPlaceholder') ?? undefined}
            disabled={!isOwner || busy}
          />
          <Text className="text-[11px] leading-snug text-text-muted">{t('settings.taxCountryHelp')}</Text>
        </View>

        {countryRates && countryRates.rates.length > 0 && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.taxOfficialTitle')}</Text>
            {countryRates.rates.map((r) => (
              <View key={r.code} className="flex-row items-center gap-2 py-1">
                <Text className="flex-1 text-[15px] font-semibold" numberOfLines={1}>{r.name}</Text>
                <Text className="text-[15px] text-text-secondary">{formatTaxRate(r.ratePercent)} %</Text>
                {r.imported ? (
                  <Text className="text-[12px] font-bold text-success">{t('settings.taxOfficialAdopted')}</Text>
                ) : (
                  isOwner && (
                    <Pressable onPress={() => importRate(r.code)} disabled={busy} className="px-3 h-10 rounded-xl bg-primary items-center justify-center disabled:opacity-40">
                      <Text className="text-papier font-extrabold">{t('settings.taxOfficialAdopt')}</Text>
                    </Pressable>
                  )
                )}
              </View>
            ))}
            <Text className="text-[11px] leading-snug text-text-muted">{t('settings.taxOfficialHelp')}</Text>
          </View>
        )}
        {countryRates && countryRates.country && countryRates.rates.length === 0 && (
          <Text className="text-[12px] leading-snug text-text-muted">{t('settings.taxOfficialNone')}</Text>
        )}

        {categories.length > 0 && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.taxDefaultLabel')}</Text>
            {categories.map((c) => {
              const selected = defaultId === c.id
              return (
                <Pressable
                  key={c.id}
                  onPress={() => isOwner && changeDefault(c.id)}
                  disabled={!isOwner || busy}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected, disabled: !isOwner || busy }}
                  className={`flex-row items-center gap-3 px-4 py-3 rounded-xl border ${selected ? 'border-primary bg-bg' : 'border-border-strong bg-bg'} ${isOwner ? '' : 'opacity-60'}`}
                >
                  <View className={`w-[22px] h-[22px] rounded-full border-2 items-center justify-center ${selected ? 'bg-primary border-primary' : 'border-border-strong'}`}>
                    {selected && <Check size={13} color="#FFFDFA" />}
                  </View>
                  <Text className="flex-1 text-[15px] font-semibold" numberOfLines={1}>{c.name}</Text>
                  <Text className="text-[15px] text-text-secondary">{formatTaxRate(c.ratePercent)} %</Text>
                </Pressable>
              )
            })}
            <Text className="text-[11px] leading-snug text-text-muted">{t('settings.taxDefaultHelp')}</Text>
          </View>
        )}

        {categories.length > 0 && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.taxRatesTitle')}</Text>
            {categories.map((c) => (
              <View key={c.id} className="flex-row items-center gap-2 py-1">
                <View className="flex-1 flex-row items-center gap-2">
                  <Text className="shrink text-[15px] font-semibold" numberOfLines={1}>{c.name}</Text>
                  {c.officialRateCode && (
                    <Text className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md ${c.followsOfficialRate ? 'bg-info-bg text-primary' : 'bg-bg-elevated text-text-muted'}`}>
                      {c.followsOfficialRate ? t('settings.taxBadgeOfficial') : t('settings.taxBadgeCustom')}
                    </Text>
                  )}
                </View>
                {editingId === c.id ? (
                  <>
                    <TextInput
                      value={editingRate}
                      onChangeText={setEditingRate}
                      keyboardType="decimal-pad"
                      autoFocus
                      accessibilityLabel={t('settings.taxRateLabel')}
                      className="h-10 w-20 rounded-xl border border-border-strong bg-bg px-3 font-semibold"
                    />
                    <Pressable onPress={() => saveRate(c.id)} disabled={busy || editingRateValue === null} className="px-3 h-10 rounded-xl bg-primary items-center justify-center disabled:opacity-40">
                      <Text className="text-papier font-extrabold">{t('settings.taxSaveRate')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setEditingId(null)} className="px-2 h-10 items-center justify-center">
                      <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <>
                    <Text className="text-[15px] text-text-secondary">{formatTaxRate(c.ratePercent)} %</Text>
                    {isOwner && (
                      <Pressable
                        disabled={busy}
                        onPress={() => { setEditingId(c.id); setEditingRate(c.ratePercent === null ? '' : String(c.ratePercent)) }}
                        className="px-2 h-10 items-center justify-center"
                      >
                        <Text className="text-primary font-bold">{t('settings.taxChangeRate')}</Text>
                      </Pressable>
                    )}
                    {isOwner && c.officialRateCode && !c.followsOfficialRate && (
                      <Pressable disabled={busy} onPress={() => followOfficial(c.id)} className="px-2 h-10 items-center justify-center">
                        <Text className="text-primary font-bold">{t('settings.taxBackToOfficial')}</Text>
                      </Pressable>
                    )}
                  </>
                )}
              </View>
            ))}
            <Text className="text-[11px] leading-snug text-text-muted">{t('settings.taxChangeRateHelp')}</Text>
          </View>
        )}

        {isOwner && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-2.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.taxAddTitle')}</Text>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              maxLength={100}
              placeholder={t('settings.taxNamePlaceholder') ?? ''}
              accessibilityLabel={t('settings.taxNameLabel')}
              className="h-12 rounded-xl border border-border-strong bg-bg px-4 font-semibold"
            />
            <View className="flex-row gap-2">
              <TextInput
                value={newRate}
                onChangeText={setNewRate}
                keyboardType="decimal-pad"
                placeholder={t('settings.taxRateLabel') ?? ''}
                accessibilityLabel={t('settings.taxRateLabel')}
                className="flex-1 h-12 rounded-xl border border-border-strong bg-bg px-4 font-semibold"
              />
              <Pressable onPress={addRate} disabled={busy || newRateValue === null || newName.trim() === ''} className="px-5 rounded-xl bg-primary items-center justify-center disabled:opacity-40">
                <Text className="text-papier font-extrabold">{t('settings.taxAddButton')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
      </ScrollView>
    </View>
  )
}
