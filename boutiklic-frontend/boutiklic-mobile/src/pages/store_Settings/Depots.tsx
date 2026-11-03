import { useCallback, useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { Ban, Check, ChevronLeft, Pencil, Plus, Sparkles, Warehouse } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { toErrorMessage } from '../../lib/apiClient'

interface DepotsProps {
  onBack: () => void
  isOwner: boolean
  multiDepotEnabled: boolean
}

/** Phase 2 de l'étude study/etude_multi_depots_transferts.md — gestion des dépôts d'une boutique
 *  (créer/renommer/désactiver). Pas de sélecteur de dépôt sur les écrans stock existants dans cet
 *  incrément : les endpoints d'ajustement/arrivage restent résolus au dépôt par défaut côté serveur
 *  (cf. étude §2.2) — le sélecteur suit dans un incrément séparé, comme côté desktop
 *  (DepotsDesktop.tsx). Écran auto-suffisant (charge ses propres données), comme PrintSettings.tsx,
 *  contrairement à Team.tsx qui partage son état avec MemberProfile via SettingsFlow. */
export default function Depots({ onBack, isOwner, multiDepotEnabled }: DepotsProps) {
  const { t } = useTranslation()
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  /** `undefined` = liste ; `null` = nouveau dépôt ; sinon dépôt en cours de renommage. */
  const [editing, setEditing] = useState<DepotResponse | null | undefined>(undefined)
  const [nameInput, setNameInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      setDepots(await depotsApi.getAll())
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const startCreate = () => {
    setNameInput('')
    setFormError(null)
    setEditing(null)
  }

  const startRename = (depot: DepotResponse) => {
    setNameInput(depot.name)
    setFormError(null)
    setEditing(depot)
  }

  const handleSave = async () => {
    if (nameInput.trim().length === 0 || saving) return
    setSaving(true)
    setFormError(null)
    try {
      if (editing) {
        await depotsApi.rename(editing.id, { name: nameInput.trim() })
      } else {
        await depotsApi.create({ name: nameInput.trim() })
      }
      setEditing(undefined)
      await load()
    } catch (e) {
      setFormError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async (depot: DepotResponse) => {
    setDeactivatingId(depot.id)
    setError(null)
    try {
      await depotsApi.deactivate(depot.id)
      await load()
    } catch (e) {
      // Message serveur explicite si le dépôt contient encore du stock (cf. DepotCommandService.deactivate).
      setError(toErrorMessage(e))
    } finally {
      setDeactivatingId(null)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4">
        <View className="flex-row items-center gap-3.5">
          <Pressable onPress={editing !== undefined ? () => setEditing(undefined) : onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.depotsTitle')}</Text>
        </View>
        {isOwner && multiDepotEnabled && editing === undefined && (
          <Pressable onPress={startCreate} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
            <Plus size={18} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {isOwner && !multiDepotEnabled && editing === undefined && (
          <View className="bg-bg-card rounded-2xl border border-border p-4 flex-row items-start gap-3">
            <Sparkles size={18} color="#B45F2E" />
            <View className="flex-1">
              <Text className="text-sm font-extrabold">{t('settings.multiDepotUpsellTitle')}</Text>
              <Text className="text-[13px] font-semibold text-text-dim mt-0.5">{t('settings.multiDepotUpsellMessage')}</Text>
            </View>
          </View>
        )}
        {editing !== undefined ? (
          <View className="bg-bg-card rounded-2xl border border-border p-4 gap-3.5">
            <Text className="text-sm font-extrabold">
              {editing ? t('settings.renameDepotModalTitle') : t('settings.newDepotModalTitle')}
            </Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              placeholder={t('settings.depotNamePlaceholder')}
              autoFocus
              className="h-[52px] rounded-xl border border-border-strong bg-bg px-4 font-bold"
            />
            {formError && <Text className="text-[13px] font-semibold text-danger">{formError}</Text>}
            <Pressable onPress={handleSave} disabled={saving || nameInput.trim().length === 0} className="w-full bg-primary py-3 rounded-xl items-center active:scale-95 disabled:opacity-50">
              <Text className="text-papier font-extrabold">{editing ? t('settings.saveChanges') : t('inventoryCatalog.create')}</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
            {isLoading ? (
              <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
            ) : depots.length === 0 ? (
              <Text className="text-[13px] font-semibold text-text-dim">{t('settings.depotsEmptyState')}</Text>
            ) : (
              depots.map((d) => (
                <View key={d.id} className="w-full bg-bg-card rounded-2xl border border-border p-3.5 flex-row items-center gap-3">
                  <View className="w-10 h-10 rounded-full bg-bg-elevated items-center justify-center">
                    <Warehouse size={18} color="#676E7E" />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2">
                      <Text className="text-sm font-bold" numberOfLines={1}>{d.name}</Text>
                      {d.isDefault && (
                        <View className="px-1.5 py-0.5 rounded-full bg-bg-elevated">
                          <Text className="text-[9px] font-extrabold text-text-muted">{t('settings.defaultDepotBadge')}</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-row items-center gap-1.5 mt-0.5">
                      {d.active ? (
                        <>
                          <Check size={12} color="#0E7A52" />
                          <Text className="text-xs font-semibold text-succes-text">{t('settings.depotActiveStatus')}</Text>
                        </>
                      ) : (
                        <Text className="text-xs font-semibold text-text-dim">{t('settings.depotInactiveStatus')}</Text>
                      )}
                    </View>
                  </View>
                  {isOwner && (
                    <View className="flex-row items-center gap-1.5">
                      <Pressable onPress={() => startRename(d)} className="w-9 h-9 rounded-xl border border-border-strong items-center justify-center">
                        <Pencil size={14} color="#111418" />
                      </Pressable>
                      {!d.isDefault && d.active && (
                        <Pressable
                          onPress={() => handleDeactivate(d)}
                          disabled={deactivatingId === d.id}
                          className="w-9 h-9 rounded-xl border border-border-strong items-center justify-center disabled:opacity-50"
                        >
                          <Ban size={14} color="#D84E2A" />
                        </Pressable>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </View>
  )
}
