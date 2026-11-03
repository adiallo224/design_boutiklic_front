import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList } from 'react-native'
import { ChevronLeft, Plus, Search } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { suppliersApi, type SupplierResponse } from '../../lib/suppliersApi'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone } from '@boutiklic/shared'
import PhoneNumberField from '../../components/PhoneNumberField'
import SupplierDetail from './SupplierDetail'

interface SuppliersListProps {
  onBack: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
}

/** Écran "Tous mes fournisseurs" (point d'entrée manquant identifié dans
 *  study/plan_parite_mobile_desktop.md) — le reste (grand livre, paiement) existe déjà dans
 *  SupplierDetail.tsx, réutilisé tel quel. Création de fournisseur : même logique offline-safe que
 *  NewArrival.tsx (queued CREATE_SUPPLIER si coupure réseau), dupliquée ici plutôt que factorisée
 *  car les deux écrans divergent ensuite (ici pas de sélection pour un arrivage en cours). */
export default function SuppliersList({ onBack }: SuppliersListProps) {
  const { t } = useTranslation()
  const { tenant } = useTenant()
  const [suppliers, setSuppliers] = useState<SupplierResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [showNewSupplier, setShowNewSupplier] = useState(false)
  const [newName, setNewName] = useState('')
  const [newCountryId, setNewCountryId] = useState('GN')
  const [newPhone, setNewPhone] = useState('')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    if (tenant.phone) setNewCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const load = () => {
    setIsLoading(true)
    setError(null)
    suppliersApi
      .getAll()
      .then(setSuppliers)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const handleCreate = async () => {
    if (newName.trim().length === 0) return
    setCreating(true)
    setError(null)
    const dialCode = PHONE_COUNTRIES.find((c) => c.id === newCountryId)?.dialCode ?? '+224'
    const payload = {
      name: newName.trim(),
      phone: newPhone.trim() ? toE164Phone(newPhone.trim(), dialCode) : undefined,
      currency: tenant.currency,
    }
    try {
      const supplier = await suppliersApi.create(payload)
      setSuppliers((prev) => [...prev, supplier])
      setShowNewSupplier(false)
      setNewName('')
      setNewPhone('')
    } catch (e) {
      if (e instanceof NetworkError) {
        await syncEngine.enqueue('CREATE_SUPPLIER', JSON.stringify(payload))
        setError(t('inventoryCatalog.supplierQueuedOffline'))
        setShowNewSupplier(false)
        setNewName('')
        setNewPhone('')
      } else {
        setError(toErrorMessage(e))
      }
    } finally {
      setCreating(false)
    }
  }

  if (selectedId) {
    return <SupplierDetail supplierId={selectedId} onBack={() => setSelectedId(null)} onPaid={load} />
  }

  const q = search.trim().toLowerCase()
  const filtered = q
    ? suppliers.filter((s) => s.name.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q) || s.location?.toLowerCase().includes(q))
    : suppliers

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.allSuppliers')}</Text>
        <Pressable
          onPress={() => setShowNewSupplier((s) => !s)}
          className={`w-10 h-10 rounded-xl items-center justify-center ${showNewSupplier ? 'border border-border-strong bg-bg-card' : 'bg-primary'}`}
        >
          <Plus size={20} strokeWidth={2.8} color={showNewSupplier ? '#111418' : '#FFFDFA'} />
        </Pressable>
      </View>

      {showNewSupplier && (
        <View className="mx-5 mb-3.5 p-4 rounded-2xl bg-bg-card border border-border gap-2.5">
          <TextInput
            value={newName}
            onChangeText={setNewName}
            placeholder={t('inventoryCatalog.supplierNamePlaceholder')}
            className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold"
          />
          <PhoneNumberField countryId={newCountryId} setCountryId={setNewCountryId} phone={newPhone} setPhone={setNewPhone} label={t('inventoryCatalog.phoneOptionalPlaceholder')} />
          <Pressable onPress={handleCreate} disabled={creating || newName.trim().length === 0} className="h-[48px] rounded-xl bg-primary items-center justify-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{creating ? t('inventoryCatalog.saving') : t('inventoryCatalog.create')}</Text>
          </Pressable>
        </View>
      )}

      <View className="px-5 pb-3">
        <View className="h-[48px] rounded-[15px] bg-bg-card border border-border-strong flex-row items-center gap-2.5 px-4">
          <Search size={18} color="#A2A9B8" />
          <TextInput value={search} onChangeText={setSearch} placeholder={t('inventoryCatalog.suppliersSearchPlaceholder')} className="flex-1 text-base" />
        </View>
      </View>

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('common.loading')}</Text>
      ) : (
        <FlatList
          className="flex-1 px-5"
          data={filtered}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('inventoryCatalog.noResults')}</Text>}
          renderItem={({ item }) => {
            const hasDebt = item.balanceDue > 0
            return (
              <Pressable onPress={() => setSelectedId(item.id)} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
                <View className={`w-11 h-11 rounded-xl items-center justify-center ${hasDebt ? 'bg-[#FBE9E4]' : 'bg-succes-bg'}`}>
                  <Text className={`text-xs font-extrabold ${hasDebt ? 'text-terracotta' : 'text-succes-text'}`}>{initials(item.name)}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold" numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text className="text-[13px] text-text-dim" numberOfLines={1}>
                    {[item.location, item.phone].filter(Boolean).join(' · ') || t('inventoryCatalog.noContactInfo')}
                  </Text>
                </View>
                <View className={`px-2.5 py-1 rounded-full ${hasDebt ? 'bg-[#FBE9E4]' : 'bg-succes-bg'}`}>
                  <Text className={`text-[11px] font-extrabold ${hasDebt ? 'text-terracotta' : 'text-succes-text'}`}>{hasDebt ? t('inventoryCatalog.supplierDebtBadge') : t('inventoryCatalog.supplierUpToDateBadge')}</Text>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </View>
  )
}
