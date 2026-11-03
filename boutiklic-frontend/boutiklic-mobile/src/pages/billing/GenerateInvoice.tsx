import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, FileText } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { billingApi, type BillingPartyType, type InvoiceResponse } from '../../lib/billingApi'
import { toErrorMessage } from '../../lib/apiClient'
import type { CustomerResponse } from '../../lib/customerApi'
import CustomerPicker from '../../components/CustomerPicker'
import InvoiceDocumentView from './InvoiceDocumentView'

interface GenerateInvoiceProps {
  saleId: string
  onBack: () => void
}

/** Bouton "Facturer" (doc TVA §3.4) — mirror mobile de
 *  desktop/pages/register_Sales/InvoiceModalDesktop.tsx, en écran plutôt qu'en modale (cohérent
 *  avec le reste de la navigation mobile). Génère une facture à la demande depuis une vente
 *  complétée ; le vendeur est résolu automatiquement côté backend. */
export default function GenerateInvoice({ saleId, onBack }: GenerateInvoiceProps) {
  const { t } = useTranslation()

  const [buyerType, setBuyerType] = useState<BillingPartyType>('PARTICULIER')
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerAddress, setBuyerAddress] = useState('')
  const [buyerTaxId, setBuyerTaxId] = useState('')
  const [buyerCustomerId, setBuyerCustomerId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [invoice, setInvoice] = useState<InvoiceResponse | null>(null)

  const canSubmit = buyerName.trim().length > 0 && !submitting

  const handleGenerate = () => {
    if (!buyerName.trim()) return
    setSubmitting(true)
    setError(null)
    billingApi
      .generateInvoice({
        saleId,
        buyerType,
        buyerName: buyerName.trim(),
        buyerPhone: buyerPhone.trim() || undefined,
        buyerAddress: buyerAddress.trim() || undefined,
        buyerTaxId: buyerTaxId.trim() || undefined,
        buyerCustomerId: buyerCustomerId ?? undefined,
      })
      .then(setInvoice)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setSubmitting(false))
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 flex-row items-center gap-2">
          <FileText size={17} color="#0E2038" />
          <Text className="text-[19px] font-extrabold tracking-tight">{t('billing.generateInvoiceTitle')}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 12, paddingBottom: 24 }} showsVerticalScrollIndicator={false}>
        {invoice ? (
          <>
            <InvoiceDocumentView invoice={invoice} />
            <Pressable onPress={onBack} className="h-[52px] rounded-2xl bg-primary items-center justify-center">
              <Text className="text-papier font-extrabold">{t('billing.closeCta')}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View className="flex-row gap-2">
              <Pressable onPress={() => setBuyerType('PARTICULIER')} className={`flex-1 h-11 rounded-xl items-center justify-center ${buyerType === 'PARTICULIER' ? 'bg-primary' : 'border border-border-strong'}`}>
                <Text className={`text-sm font-bold ${buyerType === 'PARTICULIER' ? 'text-papier' : 'text-text-muted'}`}>{t('billing.buyerTypeParticulier')}</Text>
              </Pressable>
              <Pressable onPress={() => setBuyerType('ENTREPRISE')} className={`flex-1 h-11 rounded-xl items-center justify-center ${buyerType === 'ENTREPRISE' ? 'bg-primary' : 'border border-border-strong'}`}>
                <Text className={`text-sm font-bold ${buyerType === 'ENTREPRISE' ? 'text-papier' : 'text-text-muted'}`}>{t('billing.buyerTypeEntreprise')}</Text>
              </Pressable>
            </View>

            <CustomerPicker
              selectedName={buyerCustomerId ? buyerName : null}
              onSelect={(c: CustomerResponse) => {
                setBuyerCustomerId(c.id)
                setBuyerType(c.type)
                setBuyerName(c.name)
                setBuyerPhone(c.phone ?? '')
                setBuyerAddress(c.address ?? '')
                setBuyerTaxId(c.taxId ?? '')
              }}
              onClear={() => setBuyerCustomerId(null)}
            />

            <TextInput
              value={buyerName}
              onChangeText={(v) => {
                setBuyerName(v)
                setBuyerCustomerId(null)
              }}
              placeholder={t('billing.buyerNamePlaceholder')}
              className="h-[48px] rounded-xl border border-border-strong bg-bg-card px-4 font-semibold"
              autoFocus
            />
            <TextInput value={buyerPhone} onChangeText={setBuyerPhone} placeholder={t('billing.buyerPhonePlaceholder')} keyboardType="phone-pad" className="h-[48px] rounded-xl border border-border-strong bg-bg-card px-4 font-semibold" />
            <TextInput value={buyerAddress} onChangeText={setBuyerAddress} placeholder={t('billing.buyerAddressPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg-card px-4 font-semibold" />
            {buyerType === 'ENTREPRISE' && (
              <TextInput value={buyerTaxId} onChangeText={setBuyerTaxId} placeholder={t('billing.buyerTaxIdPlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg-card px-4 font-semibold" />
            )}

            {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

            <Pressable onPress={handleGenerate} disabled={!canSubmit} className="h-[52px] rounded-2xl bg-primary items-center justify-center disabled:opacity-50">
              <Text className="text-papier font-extrabold">{submitting ? t('common.loading') : t('billing.generateInvoiceAction')}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  )
}
