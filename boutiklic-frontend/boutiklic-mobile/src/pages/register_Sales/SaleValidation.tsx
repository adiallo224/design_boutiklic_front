import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, Check, Tag, X } from 'lucide-react-native'
import NetInfo from '@react-native-community/netinfo'
import { useTranslation } from 'react-i18next'
import type { SaleLine } from '../../types'
import type { PaymentMethod, PaymentSplit } from '../../lib/salesApi'
import { ManagerApprovalPendingError, type DiscountReason, type DiscountType, type GrantDiscountRequest } from '../../lib/discountsApi'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone, resolveAmounts, toggleMethod as toggleMethodAmounts } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { toErrorMessage } from '../../lib/apiClient'
import PhoneNumberField from '../../components/PhoneNumberField'

/** Rabais choisi côté écran, envoyé au backend seulement à la confirmation (cf. CashierFlow.handleComplete). */
export interface DiscountInput extends GrantDiscountRequest {
  /** Montant retiré du total, calculé côté écran pour l'aperçu — recalculé par le backend à l'envoi. */
  amount: number
}

interface SaleValidationProps {
  total: number
  lines: SaleLine[]
  onBack: () => void
  onUpdateQuantity: (lineId: string, delta: number) => void
  onComplete: (
    payments: PaymentSplit[],
    debtCustomerName?: string,
    debtCustomerPhone?: string,
    discount?: DiscountInput,
  ) => Promise<void>
}

export default function SaleValidation({ total, lines, onBack, onUpdateQuantity, onComplete }: SaleValidationProps) {
  const { t } = useTranslation()
  const methods: { id: PaymentMethod; label: string; icon: string }[] = [
    { id: 'CASH', label: t('registerSales.methodCash'), icon: '💵' },
    { id: 'MOBILE_MONEY_ORANGE', label: t('registerSales.methodOrangeMoney'), icon: '📱' },
    { id: 'MOBILE_MONEY_WAVE', label: t('registerSales.methodWave'), icon: '🌊' },
    { id: 'DEBT', label: t('registerSales.methodDebt'), icon: '📒' },
  ]
  const REASON_LABELS: Record<DiscountReason, string> = {
    LOYAL_CUSTOMER: t('registerSales.discountReasonLoyalCustomer'),
    PRODUCT_DEFECT: t('registerSales.discountReasonProductDefect'),
    NEGOTIATION: t('registerSales.discountReasonNegotiation'),
    PRICING_ERROR: t('registerSales.discountReasonPricingError'),
    OTHER: t('registerSales.discountReasonOther'),
  }
  const { tenant } = useTenant()
  /** Montant saisi par moyen de paiement actif — présence de la clé = moyen sélectionné (écran B3,
   *  paiement fractionné). CASH pré-sélectionné pour couvrir le cas courant (un seul tap + confirmer). */
  const [amounts, setAmounts] = useState<Partial<Record<PaymentMethod, number>>>({ CASH: total })
  const [debtName, setDebtName] = useState('')
  const [debtCountryId, setDebtCountryId] = useState('GN')
  const [debtPhone, setDebtPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(true)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setDebtCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const [showDiscountPanel, setShowDiscountPanel] = useState(false)
  const [discountType, setDiscountType] = useState<DiscountType>('PERCENTAGE')
  const [discountValue, setDiscountValue] = useState('')
  const [discountReason, setDiscountReason] = useState<DiscountReason>('LOYAL_CUSTOMER')
  const [discountNote, setDiscountNote] = useState('')
  const [appliedDiscount, setAppliedDiscount] = useState<DiscountInput | null>(null)

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => setIsOnline(!!state.isConnected))
    NetInfo.fetch().then((state) => setIsOnline(!!state.isConnected))
    return () => unsubscribe()
  }, [])

  const debtDialCode = PHONE_COUNTRIES.find((c) => c.id === debtCountryId)?.dialCode ?? '+224'

  const parsedDiscountValue = parseFloat(discountValue.replace(',', '.')) || 0
  const previewDiscountAmount =
    parsedDiscountValue <= 0 ? 0 : discountType === 'PERCENTAGE' ? Math.round((total * parsedDiscountValue) / 100) : Math.round(parsedDiscountValue)

  const netTotal = total - (appliedDiscount?.amount ?? 0)

  // Un seul moyen actif : reste aligné automatiquement sur le total net (rabais compris) — reproduit
  // le comportement historique (aucune ressaisie requise). Plusieurs moyens : répartition manuelle.
  useEffect(() => {
    setAmounts((prev) => {
      const keys = Object.keys(prev) as PaymentMethod[]
      return keys.length === 1 ? { [keys[0]]: netTotal } : prev
    })
  }, [netTotal])

  // CASH absorbe automatiquement le reste en paiement mixte (cf. resolveAmounts) : les autres moyens
  // restent tels que saisis, seul CASH est dérivé à chaque frappe/ajout/retrait.
  const resolved = resolveAmounts(amounts, netTotal)
  const activeMethods = methods.filter((m) => amounts[m.id] !== undefined)
  const sumEntered = activeMethods.reduce((s, m) => s + (resolved[m.id] ?? 0), 0)
  const remaining = netTotal - sumEntered
  const isDebt = amounts.DEBT !== undefined && (amounts.DEBT ?? 0) > 0
  const debtInvalid = isDebt && (debtName.trim().length === 0 || debtPhone.trim().length < 8)
  // CASH peut légitimement retomber à 0 quand les autres moyens couvrent déjà tout — seuls les moyens
  // saisis à la main doivent être strictement positifs.
  const paymentsInvalid =
    activeMethods.length === 0 || activeMethods.some((m) => m.id !== 'CASH' && (resolved[m.id] ?? 0) <= 0) || remaining !== 0

  const toggleMethod = (id: PaymentMethod) => {
    if (lines.length === 0) return
    setAmounts((prev) => toggleMethodAmounts(prev, id, netTotal))
  }

  const setAmountFor = (id: PaymentMethod, raw: string) => {
    const value = parseFloat(raw.replace(/[^0-9.,]/g, '').replace(',', '.')) || 0
    setAmounts((prev) => ({ ...prev, [id]: value }))
  }

  const applyDiscount = () => {
    if (previewDiscountAmount <= 0 || previewDiscountAmount > total) return
    setAppliedDiscount({
      type: discountType,
      value: parsedDiscountValue,
      reason: discountReason,
      reasonNote: discountNote.trim() || undefined,
      amount: previewDiscountAmount,
    })
    setShowDiscountPanel(false)
    setDiscountValue('')
    setDiscountNote('')
  }

  const removeDiscount = () => setAppliedDiscount(null)

  const handleConfirm = async () => {
    if (debtInvalid || paymentsInvalid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const payments: PaymentSplit[] = activeMethods
        .filter((m) => (resolved[m.id] ?? 0) > 0)
        .map((m) => ({ method: m.id, amount: resolved[m.id] ?? 0 }))
      await onComplete(
        payments,
        isDebt ? debtName.trim() : undefined,
        isDebt ? toE164Phone(debtPhone.trim(), debtDialCode) : undefined,
        appliedDiscount ?? undefined,
      )
    } catch (e) {
      // Rabais hors seuil : la modale de relais gérant (rendue par CashierFlow) prend le relais
      // visuellement — pas d'erreur à afficher ici, juste réarmer le bouton pour un nouvel essai.
      if (e instanceof ManagerApprovalPendingError) {
        setSubmitting(false)
        return
      }
      setError(toErrorMessage(e))
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('registerSales.validateTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
        <View className="rounded-[20px] bg-bg-card border border-border overflow-hidden">
          {lines.map((line, i) => (
            <View key={line.id} className={`flex-row items-center gap-3 p-3.5 ${i < lines.length - 1 ? 'border-b border-border-hairline' : ''}`}>
              <View className="w-[42px] h-[42px] rounded-xl bg-bg-elevated items-center justify-center">
                <Text className="text-lg">📦</Text>
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-sm font-bold" numberOfLines={1}>
                    {line.productName}
                  </Text>
                  {line.promotionId && <Tag size={12} color="#D84E2A" />}
                </View>
                <Text className="text-[13px] text-text-dim">
                  {line.quantity} ×{' '}
                  {line.catalogPrice != null && <Text className="line-through">{line.catalogPrice.toLocaleString('fr-FR')} </Text>}
                  <Text className={line.catalogPrice != null ? 'text-terracotta font-bold' : ''}>{line.unitPrice.toLocaleString('fr-FR')}</Text>
                </Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Pressable onPress={() => onUpdateQuantity(line.id, -1)} className="w-7 h-7 rounded-[9px] border border-border-strong items-center justify-center">
                  <Text className="text-text-muted font-extrabold">−</Text>
                </Pressable>
                <Text className="text-base font-extrabold min-w-[14px] text-center">{line.quantity}</Text>
                <Pressable onPress={() => onUpdateQuantity(line.id, 1)} className="w-7 h-7 rounded-[9px] bg-primary items-center justify-center">
                  <Text className="text-papier font-extrabold">+</Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>


        {appliedDiscount ? (
          <View className="gap-2 px-[18px] py-4 rounded-2xl bg-bg-elevated">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-text-dim">{t('registerSales.subtotal')}</Text>
              <Text className="amount text-sm font-bold text-text-dim">{total.toLocaleString('fr-FR')},00</Text>
            </View>
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-semibold text-terracotta">
                {t('registerSales.discountLabel', { reason: REASON_LABELS[appliedDiscount.reason] })}
                {appliedDiscount.type === 'PERCENTAGE' ? ` (${appliedDiscount.value}%)` : ''}
              </Text>
              <View className="flex-row items-center gap-2">
                <Text className="amount text-sm font-bold text-terracotta">−{appliedDiscount.amount.toLocaleString('fr-FR')},00</Text>
                <Pressable onPress={removeDiscount}>
                  <X size={14} strokeWidth={3} color="#A2A9B8" />
                </Pressable>
              </View>
            </View>
            <View className="flex-row items-center justify-between pt-1 border-t border-border-hairline">
              <Text className="text-[15px] font-bold text-[#5C5147]">{t('registerSales.totalToPay')}</Text>
              <Text className="amount text-2xl font-extrabold">{netTotal.toLocaleString('fr-FR')},00 {tenant.currency}</Text>
            </View>
          </View>
        ) : (
          <View className="flex-row items-center justify-between px-[18px] py-4 rounded-2xl bg-bg-elevated">
            <Text className="text-[15px] font-bold text-[#5C5147]">{t('registerSales.totalToPay')}</Text>
            <Text className="amount text-2xl font-extrabold">{total.toLocaleString('fr-FR')},00 {tenant.currency}</Text>
          </View>
        )}

        {isOnline && lines.length > 0 && !appliedDiscount && !showDiscountPanel && (
          <Pressable onPress={() => setShowDiscountPanel(true)} className="flex-row items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-border-strong">
            <Tag size={16} color="#D84E2A" />
            <Text className="text-terracotta text-sm font-bold">{t('registerSales.grantDiscount')}</Text>
          </Pressable>
        )}

        {!isOnline && <Text className="text-center text-[13px] font-semibold text-text-dim">{t('registerSales.discountUnavailableOffline')}</Text>}

        {showDiscountPanel && (
          <View className="p-4 rounded-[17px] bg-bg-card border border-border gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-extrabold">{t('registerSales.discountPanelTitle')}</Text>
              <Pressable onPress={() => setShowDiscountPanel(false)}>
                <X size={16} color="#A2A9B8" />
              </Pressable>
            </View>
            <View className="flex-row gap-2">
              {(['PERCENTAGE', 'AMOUNT'] as DiscountType[]).map((type) => (
                <Pressable
                  key={type}
                  onPress={() => setDiscountType(type)}
                  className={`flex-1 py-2.5 rounded-xl items-center ${discountType === type ? 'bg-primary' : 'border border-border-strong'}`}
                >
                  <Text className={`text-sm font-bold ${discountType === type ? 'text-papier' : 'text-text-muted'}`}>{type === 'PERCENTAGE' ? '%' : tenant.currency}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={discountValue}
              onChangeText={(v) => setDiscountValue(v.replace(/[^0-9.,]/g, ''))}
              placeholder={discountType === 'PERCENTAGE' ? t('registerSales.discountValuePlaceholderPercentage') : t('registerSales.discountValuePlaceholderAmount')}
              keyboardType="decimal-pad"
              className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-bold"
            />
            <View className="flex-row flex-wrap gap-2">
              {(Object.keys(REASON_LABELS) as DiscountReason[]).map((r) => (
                <Pressable
                  key={r}
                  onPress={() => setDiscountReason(r)}
                  className={`px-3 py-2 rounded-lg ${discountReason === r ? 'bg-primary' : 'border border-border-strong'}`}
                >
                  <Text className={`text-xs ${discountReason === r ? 'font-bold text-papier' : 'font-semibold text-text-muted'}`}>{REASON_LABELS[r]}</Text>
                </Pressable>
              ))}
            </View>
            {discountReason === 'OTHER' && (
              <TextInput
                value={discountNote}
                onChangeText={setDiscountNote}
                placeholder={t('registerSales.discountNotePlaceholder')}
                className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold"
              />
            )}
            {previewDiscountAmount > total && <Text className="text-[13px] font-semibold text-danger">{t('registerSales.discountExceedsTotal')}</Text>}
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowDiscountPanel(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('registerSales.cancel')}</Text>
              </Pressable>
              <Pressable
                onPress={applyDiscount}
                disabled={previewDiscountAmount <= 0 || previewDiscountAmount > total}
                className="flex-1 py-2.5 rounded-xl bg-terracotta items-center disabled:opacity-50"
              >
                <Text className="text-papier font-extrabold">{t('registerSales.applyDiscount', { amount: previewDiscountAmount.toLocaleString('fr-FR') })}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.howCustomerPays')}</Text>
          {activeMethods.length > 1 && <Text className="text-[13px] font-semibold text-text-dim">{t('registerSales.howCustomerPaysHint')}</Text>}
          <View className="flex-row flex-wrap gap-2.5">
            {methods.map((m) => {
              const active = lines.length > 0 && amounts[m.id] !== undefined
              return (
                <Pressable
                  key={m.id}
                  onPress={() => toggleMethod(m.id)}
                  disabled={lines.length === 0}
                  className={`w-[48%] p-4 rounded-2xl gap-2 disabled:opacity-50 ${active ? 'border-2 border-success bg-succes-bg' : 'border border-border-strong bg-bg-card'}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xl">{m.icon}</Text>
                    {active && (
                      <View className="w-5 h-5 rounded-full bg-success items-center justify-center">
                        <Check size={12} strokeWidth={4} color="#FFFDFA" />
                      </View>
                    )}
                  </View>
                  <Text className={`text-base ${active ? 'font-extrabold text-succes-text' : 'font-bold'}`}>{m.label}</Text>
                </Pressable>
              )
            })}
          </View>

          {activeMethods.length > 1 && (
            <View className="gap-2">
              {activeMethods.map((m) => {
                const isAutoCash = m.id === 'CASH'
                return (
                  <View key={m.id} className={`h-[52px] rounded-2xl flex-row items-center px-4 gap-2.5 border border-border-strong ${isAutoCash ? 'bg-bg-elevated' : 'bg-bg-card'}`}>
                    <Text className="text-lg">{m.icon}</Text>
                    <Text className="flex-1 text-sm font-bold text-text-muted">
                      {m.label}
                      {isAutoCash && <Text className="text-[11px] font-semibold text-text-dim"> {t('registerSales.cashAuto')}</Text>}
                    </Text>
                    <TextInput
                      value={String(resolved[m.id] ?? 0)}
                      onChangeText={(v) => setAmountFor(m.id, v)}
                      editable={!isAutoCash}
                      keyboardType="decimal-pad"
                      className={`amount w-28 text-right font-extrabold ${isAutoCash ? 'text-text-dim' : ''}`}
                    />
                  </View>
                )
              })}
              <Text className={`text-[13px] font-semibold text-center ${remaining === 0 ? 'text-success' : 'text-danger'}`}>
                {remaining === 0
                  ? t('registerSales.fullyAllocated')
                  : remaining < 0
                    ? t('registerSales.exceedsTotal', { amount: Math.abs(remaining).toLocaleString('fr-FR') })
                    : t('registerSales.remainingToAllocate', { amount: remaining.toLocaleString('fr-FR') })}
              </Text>
            </View>
          )}
        </View>

        {isDebt && (
          <View className="gap-2.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.clientTitle')}</Text>
            <TextInput
              value={debtName}
              onChangeText={setDebtName}
              placeholder={t('registerSales.customerNamePlaceholder')}
              className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold"
            />
            <PhoneNumberField countryId={debtCountryId} setCountryId={setDebtCountryId} phone={debtPhone} setPhone={setDebtPhone} label={t('registerSales.customerPhoneLabel')} />
          </View>
        )}
      </ScrollView>

      <View className="px-5 pt-4 pb-9 gap-2.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable
          onPress={handleConfirm}
          disabled={submitting || debtInvalid || paymentsInvalid || lines.length === 0}
          className="h-16 rounded-[18px] bg-success items-center justify-center flex-row gap-2.5 disabled:opacity-50"
        >
          <Check size={22} strokeWidth={2.6} color="#FFFDFA" />
          <Text className="text-papier text-lg font-extrabold">{submitting ? t('registerSales.recording') : t('registerSales.confirmAmount', { amount: netTotal.toLocaleString('fr-FR') })}</Text>
        </Pressable>
        <Text className="text-center text-[13px] font-semibold text-text-dim">{t('registerSales.onlineRecording')}</Text>
      </View>
    </View>
  )
}
