import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Linking } from 'react-native'
import { ChevronLeft, Phone, ShoppingCart } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { isSupportedLocale, DEFAULT_LOCALE, formatNumber } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { suppliersApi, type SupplierResponse, type SupplierTransactionResponse } from '../../lib/suppliersApi'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import { formatDate } from '../../lib/dateFormat'

interface SupplierDetailProps {
  supplierId: string
  onBack: () => void
  onPaid?: () => void
  /** Absent = bouton masqué (écran C7) — n'affiche "Commande" que si l'appelant peut effectivement
   *  y donner suite (aujourd'hui, uniquement depuis NewArrival déjà scopé au fournisseur). */
  onNewOrder?: () => void
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '??'
}

export default function SupplierDetail({ supplierId, onBack, onPaid, onNewOrder }: SupplierDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { formatCurrency } = useTenant()
  const [supplier, setSupplier] = useState<SupplierResponse | null>(null)
  const [transactions, setTransactions] = useState<SupplierTransactionResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPay, setShowPay] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payNote, setPayNote] = useState('')
  const [paying, setPaying] = useState(false)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [s, tx] = await Promise.all([suppliersApi.getById(supplierId), suppliersApi.getTransactions(supplierId)])
      setSupplier(s)
      setTransactions(tx)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierId])

  const handlePay = async () => {
    const amount = Number(payAmount)
    if (!amount || amount <= 0 || !supplier) return
    setPaying(true)
    setError(null)
    const payload = { amount, currency: supplier.currency, note: payNote.trim() || undefined }
    try {
      try {
        await suppliersApi.pay(supplierId, payload)
        await load()
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts). Le solde affiché ne bougera qu'au
        // prochain rechargement réussi — pas de recalcul local (append-only côté serveur).
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('PAY_SUPPLIER', JSON.stringify({ supplierId, ...payload }))
      }
      setShowPay(false)
      setPayAmount('')
      setPayNote('')
      onPaid?.()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setPaying(false)
    }
  }

  if (isLoading && !supplier) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center mb-4">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }

  if (!supplier) {
    return (
      <View className="flex-1 bg-bg px-5 pt-4 gap-3">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[13px] font-semibold text-danger">{error ?? t('inventoryCatalog.supplierNotFound')}</Text>
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="px-5 pb-5 relative overflow-hidden" style={{ backgroundColor: '#6B5F4E' }}>
        <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />
        <View className="flex-row items-center justify-between pt-4 pb-5">
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl bg-papier/15 items-center justify-center">
            <ChevronLeft size={20} color="#FFFDFA" />
          </Pressable>
        </View>
        <View className="flex-row items-center gap-3.5">
          <View className="w-[62px] h-[62px] rounded-2xl bg-warning items-center justify-center">
            <Text className="text-xl font-extrabold text-encre">{initials(supplier.name)}</Text>
          </View>
          <View className="gap-0.5">
            <Text className="font-display text-2xl font-extrabold text-papier tracking-tight">{supplier.name}</Text>
            <Text className="amount text-sm font-semibold text-papier/70">{[supplier.location, supplier.phone].filter(Boolean).join(' · ') || t('inventoryCatalog.noContactInfo')}</Text>
          </View>
        </View>
      </View>

      <View className="px-5 pt-4 pb-3.5">
        <View className="p-[18px] rounded-[20px] bg-alerte-bg border border-[#EED9AE] gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-alerte-text">{t('inventoryCatalog.whatYouOweLabel')}</Text>
          <Text className="amount text-[32px] font-extrabold text-[#6B5410] tracking-tight">{formatCurrency(supplier.balanceDue)}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.recentExchangesLabel')}</Text>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {transactions.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.noExchangesYet')}</Text>
        ) : (
          transactions.map((tx) => {
            const isPayment = tx.type === 'PAYMENT'
            return (
              <View key={tx.id} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
                <View className="w-8 h-8 rounded-[10px] items-center justify-center" style={{ backgroundColor: isPayment ? '#E6F1EC' : '#EDE6D0' }}>
                  <Text className="text-sm font-extrabold" style={{ color: isPayment ? '#1F5C43' : '#6B5F4E' }}>
                    {isPayment ? '−' : '+'}
                  </Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-[15px] font-bold">{isPayment ? tx.note || t('inventoryCatalog.payment') : t('inventoryCatalog.arrival')}</Text>
                  <Text className="text-[13px] text-text-dim">{formatDate(tx.createdAt, { day: 'numeric', month: 'long' })}</Text>
                </View>
                <Text className="amount text-[15px] font-extrabold" style={{ color: isPayment ? '#1F5C43' : undefined }}>
                  {formatNumber(tx.amount, locale)}
                </Text>
              </View>
            )
          })
        )}

        {showPay && (
          <View className="p-4 rounded-2xl bg-bg-card border border-border gap-3 mt-1">
            <Text className="text-sm font-extrabold">{t('inventoryCatalog.recordPaymentTitle')}</Text>
            <TextInput keyboardType="number-pad" value={payAmount} onChangeText={setPayAmount} placeholder={t('inventoryCatalog.amountPlaceholder')} className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-extrabold" />
            <TextInput value={payNote} onChangeText={setPayNote} placeholder={t('inventoryCatalog.noteOptionalPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
            <Pressable onPress={handlePay} disabled={paying || !payAmount || Number(payAmount) <= 0} className="h-[52px] rounded-xl bg-primary items-center justify-center disabled:opacity-50">
              <Text className="text-papier font-extrabold">{paying ? t('inventoryCatalog.saving') : t('inventoryCatalog.confirmPayment')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <View className="px-5 pt-3 pb-9 flex-row gap-2.5">
        <Pressable
          onPress={() => supplier.phone && Linking.openURL(`tel:${supplier.phone}`)}
          disabled={!supplier.phone}
          className="flex-1 h-[62px] rounded-[17px] border border-border-strong bg-bg-card items-center justify-center flex-row gap-2 disabled:opacity-40"
        >
          <Phone size={19} color="#111418" />
          <Text className="text-base font-bold">{t('inventoryCatalog.call')}</Text>
        </Pressable>
        {onNewOrder && (
          <Pressable onPress={onNewOrder} className="flex-1 h-[62px] rounded-[17px] border border-border-strong bg-bg-card items-center justify-center flex-row gap-2">
            <ShoppingCart size={19} color="#111418" />
            <Text className="text-base font-bold">{t('inventoryCatalog.order')}</Text>
          </Pressable>
        )}
        <Pressable onPress={() => setShowPay((s) => !s)} disabled={supplier.balanceDue <= 0} className="flex-[1.3] h-[62px] rounded-[17px] bg-primary items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-[17px] font-extrabold">{t('inventoryCatalog.pay')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
