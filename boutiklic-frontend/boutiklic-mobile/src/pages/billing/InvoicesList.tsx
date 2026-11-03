import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, ScrollView } from 'react-native'
import { ChevronLeft, Search } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { billingApi, type InvoiceResponse } from '../../lib/billingApi'
import { toErrorMessage } from '../../lib/apiClient'
import { formatDate } from '../../lib/dateFormat'
import InvoiceDocumentView from './InvoiceDocumentView'

interface InvoicesListProps {
  onBack: () => void
}

/** Historique des factures — mirror mobile de desktop/pages/billing/DesktopInvoices.tsx, en liste +
 *  écran de détail séparé plutôt qu'en maître-détail côte à côte. */
export default function InvoicesList({ onBack }: InvoicesListProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [invoices, setInvoices] = useState<InvoiceResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    setIsLoading(true)
    setError(null)
    billingApi
      .listInvoices()
      .then((list) => setInvoices([...list].sort((a, b) => (a.issuedAt < b.issuedAt ? 1 : -1))))
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return invoices
    return invoices.filter((inv) => inv.number.toLowerCase().includes(q) || inv.buyerName.toLowerCase().includes(q))
  }, [invoices, query])

  const selected = invoices.find((inv) => inv.id === selectedId) ?? null

  if (selected) {
    return (
      <View className="flex-1 bg-bg">
        <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
          <Pressable onPress={() => setSelectedId(null)} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
          <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{selected.number}</Text>
        </View>
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
          <InvoiceDocumentView invoice={selected} />
        </ScrollView>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('billing.invoicesPageTitle')}</Text>
      </View>

      <View className="px-5 pb-3">
        <View className="h-[48px] rounded-[15px] bg-bg-card border border-border-strong flex-row items-center gap-2.5 px-4">
          <Search size={18} color="#A2A9B8" />
          <TextInput value={query} onChangeText={setQuery} placeholder={t('billing.searchInvoicePlaceholder')} className="flex-1 text-base" />
        </View>
      </View>

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('common.loading')}</Text>
      ) : (
        <FlatList
          className="flex-1 px-5"
          data={filtered}
          keyExtractor={(inv) => inv.id}
          contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('billing.emptyInvoicesState')}</Text>}
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedId(item.id)} className="p-3.5 rounded-2xl bg-bg-card border border-border gap-1">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="amount text-sm font-extrabold" numberOfLines={1}>
                  {item.number}
                </Text>
                <Text className="text-[11px] font-bold text-text-dim">{formatDate(item.issuedAt)}</Text>
              </View>
              <Text className="text-[13px] text-text-dim" numberOfLines={1}>
                {item.buyerName}
              </Text>
              <Text className="amount text-base font-extrabold">
                {formatNumber(item.totalTtc, locale)} {item.currency}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  )
}
