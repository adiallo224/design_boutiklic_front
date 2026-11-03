import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList } from 'react-native'
import { ChevronLeft, Plus, X } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { isSupportedLocale, DEFAULT_LOCALE, formatNumber } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { billingApi, type QuoteResponse, type QuoteStatus, type BillingPartyType } from '../../lib/billingApi'
import { toErrorMessage } from '../../lib/apiClient'
import type { CustomerResponse } from '../../lib/customerApi'
import CustomerPicker from '../../components/CustomerPicker'
import QuoteDetail from './QuoteDetail'

interface QuotesListProps {
  onBack: () => void
}

const STATUS_LABEL_KEY: Record<QuoteStatus, string> = {
  DRAFT: 'billing.statusDraft',
  SENT: 'billing.statusSent',
  ACCEPTED: 'billing.statusAccepted',
  REFUSED: 'billing.statusRefused',
  EXPIRED: 'billing.statusExpired',
  CONVERTED: 'billing.statusConverted',
}

const STATUS_BADGE_CLASS: Record<QuoteStatus, string> = {
  DRAFT: 'bg-bg-elevated',
  SENT: 'bg-info-bg',
  ACCEPTED: 'bg-succes-bg',
  REFUSED: 'bg-[#FBE9E4]',
  EXPIRED: 'bg-bg-elevated',
  CONVERTED: 'bg-succes-bg',
}

const STATUS_TEXT_CLASS: Record<QuoteStatus, string> = {
  DRAFT: 'text-text-muted',
  SENT: 'text-primary',
  ACCEPTED: 'text-succes-text',
  REFUSED: 'text-terracotta',
  EXPIRED: 'text-text-dim',
  CONVERTED: 'text-succes-text',
}

/** Devis (Phase 3, doc TVA §3.4) — mirror mobile de desktop/pages/billing/DesktopQuotes.tsx, en
 *  liste + écran de détail séparé (QuoteDetail.tsx) plutôt qu'en maître-détail côte à côte. */
export default function QuotesList({ onBack }: QuotesListProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()

  const [quotes, setQuotes] = useState<QuoteResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [showForm, setShowForm] = useState(false)
  const [busy, setBusy] = useState(false)
  const [newBuyerType, setNewBuyerType] = useState<BillingPartyType>('PARTICULIER')
  const [newBuyerName, setNewBuyerName] = useState('')
  const [newBuyerPhone, setNewBuyerPhone] = useState('')
  const [newBuyerAddress, setNewBuyerAddress] = useState('')
  const [newBuyerTaxId, setNewBuyerTaxId] = useState('')
  const [newBuyerCustomerId, setNewBuyerCustomerId] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    setError(null)
    billingApi
      .list()
      .then(setQuotes)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const resetForm = () => {
    setNewBuyerType('PARTICULIER')
    setNewBuyerName('')
    setNewBuyerPhone('')
    setNewBuyerAddress('')
    setNewBuyerTaxId('')
    setNewBuyerCustomerId(null)
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const handleCreate = async () => {
    if (newBuyerName.trim().length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      const quote = await billingApi.createQuote({
        currency: tenant.currency,
        buyerType: newBuyerType,
        buyerName: newBuyerName.trim(),
        buyerPhone: newBuyerPhone.trim() || undefined,
        buyerAddress: newBuyerAddress.trim() || undefined,
        buyerTaxId: newBuyerTaxId.trim() || undefined,
        customerId: newBuyerCustomerId ?? undefined,
      })
      setQuotes((prev) => [quote, ...prev])
      closeForm()
      setSelectedId(quote.id)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (selectedId) {
    return (
      <QuoteDetail
        quoteId={selectedId}
        onBack={() => setSelectedId(null)}
        onChanged={(updated) => setQuotes((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))}
      />
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('billing.quotesPageTitle')}</Text>
        <Pressable
          onPress={() => (showForm ? closeForm() : setShowForm(true))}
          className={`w-10 h-10 rounded-xl items-center justify-center ${showForm ? 'border border-border-strong bg-bg-card' : 'bg-primary'}`}
        >
          {showForm ? <X size={20} color="#111418" /> : <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />}
        </Pressable>
      </View>

      {showForm && (
        <View className="mx-5 mb-3.5 p-4 rounded-2xl bg-bg-card border border-border gap-2.5">
          <Text className="text-sm font-extrabold">{t('billing.newQuoteTitle')}</Text>
          <View className="flex-row gap-2">
            <Pressable onPress={() => setNewBuyerType('PARTICULIER')} className={`flex-1 h-11 rounded-xl items-center justify-center ${newBuyerType === 'PARTICULIER' ? 'bg-primary' : 'border border-border-strong'}`}>
              <Text className={`text-sm font-bold ${newBuyerType === 'PARTICULIER' ? 'text-papier' : 'text-text-muted'}`}>{t('billing.buyerTypeParticulier')}</Text>
            </Pressable>
            <Pressable onPress={() => setNewBuyerType('ENTREPRISE')} className={`flex-1 h-11 rounded-xl items-center justify-center ${newBuyerType === 'ENTREPRISE' ? 'bg-primary' : 'border border-border-strong'}`}>
              <Text className={`text-sm font-bold ${newBuyerType === 'ENTREPRISE' ? 'text-papier' : 'text-text-muted'}`}>{t('billing.buyerTypeEntreprise')}</Text>
            </Pressable>
          </View>
          <CustomerPicker
            selectedName={newBuyerCustomerId ? newBuyerName : null}
            onSelect={(c: CustomerResponse) => {
              setNewBuyerCustomerId(c.id)
              setNewBuyerType(c.type)
              setNewBuyerName(c.name)
              setNewBuyerPhone(c.phone ?? '')
              setNewBuyerAddress(c.address ?? '')
              setNewBuyerTaxId(c.taxId ?? '')
            }}
            onClear={() => setNewBuyerCustomerId(null)}
          />
          <TextInput
            value={newBuyerName}
            onChangeText={(v) => {
              setNewBuyerName(v)
              setNewBuyerCustomerId(null)
            }}
            placeholder={t('billing.buyerNamePlaceholder')}
            className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold"
          />
          <TextInput value={newBuyerPhone} onChangeText={setNewBuyerPhone} placeholder={t('billing.buyerPhonePlaceholder')} keyboardType="phone-pad" className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          <TextInput value={newBuyerAddress} onChangeText={setNewBuyerAddress} placeholder={t('billing.buyerAddressPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          {newBuyerType === 'ENTREPRISE' && (
            <TextInput value={newBuyerTaxId} onChangeText={setNewBuyerTaxId} placeholder={t('billing.buyerTaxIdPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
          )}
          <Pressable onPress={handleCreate} disabled={busy || newBuyerName.trim().length === 0} className="h-[48px] rounded-xl bg-primary items-center justify-center disabled:opacity-50">
            <Text className="text-papier font-extrabold">{busy ? t('inventoryCatalog.saving') : t('billing.create')}</Text>
          </Pressable>
        </View>
      )}

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('common.loading')}</Text>
      ) : (
        <FlatList
          className="flex-1 px-5"
          data={quotes}
          keyExtractor={(q) => q.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('billing.emptyState')}</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedId(item.id)} className="p-3.5 rounded-2xl bg-bg-card border border-border gap-2">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold" numberOfLines={1}>
                    {item.buyerName}
                  </Text>
                  <Text className="text-[13px] text-text-dim">{t('billing.linesCount', { count: item.lines.length })}</Text>
                </View>
                <View className={`px-2.5 py-1 rounded-full ${STATUS_BADGE_CLASS[item.status]}`}>
                  <Text className={`text-[11px] font-extrabold ${STATUS_TEXT_CLASS[item.status]}`}>{t(STATUS_LABEL_KEY[item.status])}</Text>
                </View>
              </View>
              <Text className="amount text-base font-extrabold">{formatNumber(item.totalTtc, locale)}</Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
