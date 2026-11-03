import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList } from 'react-native'
import { Check, ChevronLeft, Plus, Search, Pencil, UserX, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { customerApi, type CustomerResponse, type CustomerType } from '../../lib/customerApi'
import { toErrorMessage } from '../../lib/apiClient'
import { useAuth } from '../../hooks/useAuth'

interface CustomerDirectoryProps {
  onBack: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
}

/** Annuaire client (module customer, doc TVA §7 — cf. étude study/plan_parite_mobile_desktop.md) —
 *  portage mobile de desktop/pages/customer/DesktopCustomers.tsx. Écran CRUD simple, comme sur
 *  desktop : le backend n'expose qu'une désactivation logique, pas de suppression physique, et pas
 *  de gestion hors-ligne particulière (même périmètre que la version web). */
export default function CustomerDirectory({ onBack }: CustomerDirectoryProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  // L'exonération de TVA est un choix fiscal : réservé au propriétaire (comme côté serveur).
  const isOwner = user?.role === 'OWNER'
  const [customers, setCustomers] = useState<CustomerResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formType, setFormType] = useState<CustomerType>('PARTICULIER')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formAddress, setFormAddress] = useState('')
  const [formTaxId, setFormTaxId] = useState('')
  const [formExempt, setFormExempt] = useState(false)
  const [formExemptReason, setFormExemptReason] = useState('')

  const load = () => {
    setIsLoading(true)
    setError(null)
    customerApi
      .search()
      .then(setCustomers)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return customers
    return customers.filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q))
  }, [customers, search])

  const resetForm = () => {
    setEditingId(null)
    setFormType('PARTICULIER')
    setFormName('')
    setFormPhone('')
    setFormAddress('')
    setFormTaxId('')
    setFormExempt(false)
    setFormExemptReason('')
  }

  const openCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const openEdit = (c: CustomerResponse) => {
    setEditingId(c.id)
    setFormType(c.type)
    setFormName(c.name)
    setFormPhone(c.phone ?? '')
    setFormAddress(c.address ?? '')
    setFormTaxId(c.taxId ?? '')
    setFormExempt(c.taxExempt)
    setFormExemptReason(c.taxExemptionReason ?? '')
    setShowForm(true)
  }

  const handleSave = async () => {
    if (formName.trim().length === 0 || busy) return
    setBusy(true)
    setError(null)
    const payload = {
      type: formType,
      name: formName.trim(),
      phone: formPhone.trim() || undefined,
      address: formAddress.trim() || undefined,
      taxId: formType === 'ENTREPRISE' ? formTaxId.trim() || undefined : undefined,
    }
    try {
      if (editingId) {
        let updated = await customerApi.update(editingId, payload)
        const exemptionChanged = isOwner && (formExempt !== updated.taxExempt || (formExempt && formExemptReason.trim() !== (updated.taxExemptionReason ?? '')))
        if (exemptionChanged) updated = await customerApi.changeTaxExemption(updated.id, formExempt, formExemptReason.trim())
        setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
      } else {
        let created = await customerApi.create(payload)
        if (isOwner && formExempt) created = await customerApi.changeTaxExemption(created.id, true, formExemptReason.trim())
        setCustomers((prev) => [created, ...prev])
      }
      closeForm()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async (c: CustomerResponse) => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await customerApi.deactivate(c.id)
      setCustomers((prev) => prev.map((x) => (x.id === c.id ? { ...x, active: false } : x)))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('customerDirectory.pageTitle')}</Text>
        <Pressable
          onPress={() => (showForm ? closeForm() : openCreate())}
          className={`w-10 h-10 rounded-xl items-center justify-center ${showForm ? 'border border-border-strong bg-bg-card' : 'bg-primary'}`}
        >
          {showForm ? <X size={20} color="#111418" /> : <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />}
        </Pressable>
      </View>

      {showForm && (
        <View className="mx-5 mb-3.5 p-4 rounded-2xl bg-bg-card border border-border gap-2.5">
          <Text className="text-sm font-extrabold">{editingId ? t('customerDirectory.editCustomerTitle') : t('customerDirectory.newCustomerTitle')}</Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setFormType('PARTICULIER')} className={`flex-1 h-11 rounded-xl items-center justify-center ${formType === 'PARTICULIER' ? 'bg-primary' : 'border border-border-strong'}`}>
              <Text className={`text-sm font-bold ${formType === 'PARTICULIER' ? 'text-papier' : 'text-text-muted'}`}>{t('customerDirectory.typeParticulier')}</Text>
            </Pressable>
            <Pressable onPress={() => setFormType('ENTREPRISE')} className={`flex-1 h-11 rounded-xl items-center justify-center ${formType === 'ENTREPRISE' ? 'bg-primary' : 'border border-border-strong'}`}>
              <Text className={`text-sm font-bold ${formType === 'ENTREPRISE' ? 'text-papier' : 'text-text-muted'}`}>{t('customerDirectory.typeEntreprise')}</Text>
            </Pressable>
          </View>
          <TextInput value={formName} onChangeText={setFormName} placeholder={t('customerDirectory.namePlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          <TextInput value={formPhone} onChangeText={setFormPhone} placeholder={t('customerDirectory.phonePlaceholder')} keyboardType="phone-pad" className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          <TextInput value={formAddress} onChangeText={setFormAddress} placeholder={t('customerDirectory.addressPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          {formType === 'ENTREPRISE' && (
            <TextInput value={formTaxId} onChangeText={setFormTaxId} placeholder={t('customerDirectory.taxIdPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          )}
          {isOwner && (
            <View className="gap-2 p-3 rounded-xl border border-border bg-bg">
              <Pressable
                onPress={() => setFormExempt((v) => !v)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: formExempt }}
                className="flex-row items-center gap-2.5"
              >
                <View className={`w-[22px] h-[22px] rounded-md border-2 items-center justify-center ${formExempt ? 'bg-primary border-primary' : 'border-border-strong'}`}>
                  {formExempt && <Check size={13} color="#FFFDFA" />}
                </View>
                <Text className="flex-1 text-sm font-bold">{t('customerDirectory.taxExemptLabel')}</Text>
              </Pressable>
              {formExempt && (
                <>
                  <TextInput
                    value={formExemptReason}
                    onChangeText={setFormExemptReason}
                    maxLength={255}
                    placeholder={t('customerDirectory.taxExemptReasonPlaceholder')}
                    className="h-[48px] rounded-xl border border-border-strong bg-bg-card px-4 font-semibold"
                  />
                  <Text className="text-[11px] leading-snug text-text-muted">{t('customerDirectory.taxExemptHelp')}</Text>
                </>
              )}
            </View>
          )}
          <Pressable onPress={handleSave} disabled={busy || formName.trim().length === 0 || (isOwner && formExempt && formExemptReason.trim().length === 0)} className="h-[48px] rounded-xl bg-primary items-center justify-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{busy ? t('inventoryCatalog.saving') : t('customerDirectory.saveCta')}</Text>
          </Pressable>
        </View>
      )}

      <View className="px-5 pb-3">
        <View className="h-[48px] rounded-[15px] bg-bg-card border border-border-strong flex-row items-center gap-2.5 px-4">
          <Search size={18} color="#A2A9B8" />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('customerDirectory.searchPlaceholder')} className="flex-1 text-base" />
        </View>
      </View>

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('common.loading')}</Text>
      ) : (
        <FlatList
          className="flex-1 px-5"
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-8">{search ? t('customerDirectory.noMatch') : t('customerDirectory.emptyState')}</Text>}
          renderItem={({ item }) => (
            <View className={`flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border ${!item.active ? 'opacity-60' : ''}`}>
              <View className="w-11 h-11 rounded-xl bg-bg-elevated items-center justify-center">
                <Text className="text-xs font-extrabold text-text">{initials(item.name)}</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-[13px] text-text-dim" numberOfLines={1}>
                  {item.type === 'ENTREPRISE' ? t('customerDirectory.typeEntreprise') : t('customerDirectory.typeParticulier')}
                  {item.phone ? ` · ${item.phone}` : ''}
                </Text>
                {!item.active && <Text className="text-[11px] font-extrabold text-text-dim">{t('customerDirectory.inactive')}</Text>}
                {item.taxExempt && <Text className="text-[11px] font-extrabold text-succes-text">{t('customerDirectory.taxExemptBadge')}</Text>}
              </View>
              <Pressable onPress={() => openEdit(item)} className="w-9 h-9 rounded-lg border border-border-strong items-center justify-center">
                <Pencil size={14} color="#676E7E" />
              </Pressable>
              {item.active && (
                <Pressable onPress={() => handleDeactivate(item)} disabled={busy} className="w-9 h-9 rounded-lg border border-[#F0C9C2] items-center justify-center disabled:opacity-50">
                  <UserX size={14} color="#C6362F" />
                </Pressable>
              )}
            </View>
          )}
        />
      )}
    </View>
  )
}
