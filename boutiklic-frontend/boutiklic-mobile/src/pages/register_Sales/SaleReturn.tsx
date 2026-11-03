import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { salesApi, type SaleResponse, type RefundMethod } from '../../lib/salesApi'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { toErrorMessage } from '../../lib/apiClient'
import PhoneNumberField from '../../components/PhoneNumberField'

interface SaleReturnProps {
  saleId: string
  time: string
  onBack: () => void
}

export default function SaleReturn({ saleId, time, onBack }: SaleReturnProps) {
  const { t } = useTranslation()
  const REASONS = [t('registerSales.returnReasonDamaged'), t('registerSales.returnReasonCashierError'), t('registerSales.returnReasonCustomerChangedMind')] as const
  /** Remise en stock par défaut selon le motif — modifiable ensuite par ligne (bouton "Remettre en stock").
   *  Comparaison par index (REASONS[0]) plutôt que par chaîne en dur, pour rester correct une fois "Produit abîmé" traduit. */
  const defaultRestock = (reason: string): boolean => reason !== REASONS[0]
  const { tenant } = useTenant()
  const [sale, setSale] = useState<SaleResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<Record<string, boolean>>({})
  const [restockByLine, setRestockByLine] = useState<Record<string, boolean>>({})
  const [reason, setReason] = useState<string>(REASONS[0])
  const [method, setMethod] = useState<RefundMethod>('CASH')
  const [customerName, setCustomerName] = useState('')
  const [countryId, setCountryId] = useState('GN')
  const [customerPhone, setCustomerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  useEffect(() => {
    salesApi
      .getById(saleId)
      .then((s) => {
        setSale(s)
        setSelected(Object.fromEntries(s.lines.map((l) => [l.id, false])))
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [saleId])

  const toggleLine = (lineId: string) => {
    const nowSelected = !selected[lineId]
    setSelected((s) => ({ ...s, [lineId]: nowSelected }))
    if (nowSelected && restockByLine[lineId] === undefined) {
      setRestockByLine((r) => ({ ...r, [lineId]: defaultRestock(reason) }))
    }
  }

  const toggleRestock = (lineId: string) => {
    setRestockByLine((r) => ({ ...r, [lineId]: !r[lineId] }))
  }

  const total = (sale?.lines ?? []).filter((l) => selected[l.id]).reduce((sum, l) => sum + l.lineTotal, 0)
  const anySelected = Object.values(selected).some(Boolean)
  const isCredit = method === 'CREDIT'
  const isDebtMethod = method === 'DEBT'
  const debtUnavailable = isDebtMethod && sale?.debtId == null
  const creditInvalid = isCredit && (customerName.trim().length === 0 || customerPhone.trim().length < 8)
  const canSubmit = anySelected && !creditInvalid && !debtUnavailable && !submitting
  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'

  const handleSubmit = async () => {
    if (!sale || !canSubmit) return
    setSubmitting(true)
    setError(null)
    try {
      const lines = sale.lines
        .filter((l) => selected[l.id])
        .map((l) => ({ saleLineId: l.id, restock: restockByLine[l.id] ?? defaultRestock(reason) }))
      await salesApi.processReturn(saleId, {
        reason,
        refundMethod: method,
        lines,
        customerName: isCredit ? customerName.trim() : undefined,
        customerPhone: isCredit ? toE164Phone(customerPhone.trim(), dialCode) : undefined,
      })
      onBack()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('registerSales.returnTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {t('registerSales.returnTicketToday', { id: saleId.slice(-4), time })}
          </Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 16 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : (
          <View className="gap-2.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.ticketItems')}</Text>
            {(sale?.lines ?? []).map((line) => {
              const checked = !!selected[line.id]
              const restock = restockByLine[line.id] ?? defaultRestock(reason)
              return (
                <View
                  key={line.id}
                  className={`gap-2.5 p-3.5 rounded-2xl bg-bg-card ${checked ? 'border-2 border-terracotta' : 'border border-border'}`}
                >
                  <Pressable onPress={() => toggleLine(line.id)} className="flex-row items-center gap-3.5">
                    <View className={`w-6 h-6 rounded-lg items-center justify-center ${checked ? 'bg-terracotta' : 'border-2 border-[#DDD2C3]'}`}>
                      {checked && <Check size={14} strokeWidth={3.4} color="#FFFDFA" />}
                    </View>
                    <View className="w-11 h-11 rounded-xl bg-bg-elevated items-center justify-center">
                      <Text className="text-xl">📦</Text>
                    </View>
                    <View className="flex-1 gap-0.5">
                      <Text className="text-[15px] font-bold" numberOfLines={1}>
                        {line.productName}
                      </Text>
                      <Text className="text-[13px] text-text-dim">
                        {t('registerSales.soldCount', { count: line.quantity })}
                      </Text>
                    </View>
                    <Text className={`amount text-base font-extrabold ${checked ? '' : 'text-[#BDB1A3]'}`}>{line.lineTotal.toLocaleString('fr-FR')}</Text>
                  </Pressable>
                  {checked && (
                    <Pressable onPress={() => toggleRestock(line.id)} className="flex-row items-center justify-between pl-[58px] pr-1">
                      <Text className="text-[13px] font-semibold text-text-dim">{t('registerSales.restockToggle')}</Text>
                      <View className={`w-[42px] h-[25px] rounded-full p-[3px] flex-row ${restock ? 'bg-success justify-end' : 'bg-bg-elevated justify-start'}`}>
                        <View className="w-[19px] h-[19px] rounded-full bg-papier" />
                      </View>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        )}

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.returnReasonTitle')}</Text>
          <View className="flex-row flex-wrap gap-2">
            {REASONS.map((r) => (
              <Pressable key={r} onPress={() => setReason(r)} className={`px-4 py-2.5 rounded-xl ${reason === r ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
                <Text className={`text-sm ${reason === r ? 'font-bold text-papier' : 'font-semibold text-[#5C5147]'}`}>{r}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.refundMethodTitle')}</Text>
          <View className="flex-row gap-2.5">
            {[
              { id: 'CASH' as const, label: t('registerSales.methodCash') },
              { id: 'CREDIT' as const, label: t('registerSales.methodCredit') },
              { id: 'DEBT' as const, label: t('registerSales.methodDebtRefund') },
            ].map((m) => (
              <Pressable
                key={m.id}
                onPress={() => setMethod(m.id)}
                className={`flex-1 h-14 rounded-2xl items-center justify-center ${
                  method === m.id ? 'border-2 border-terracotta bg-[#F7E9E5]' : 'border border-border-strong bg-bg-card'
                }`}
              >
                <Text className={`text-[15px] ${method === m.id ? 'font-extrabold text-[#8F3B23]' : 'font-bold text-[#5C5147]'}`}>{m.label}</Text>
              </Pressable>
            ))}
          </View>
          {debtUnavailable && (
            <Text className="text-[13px] font-semibold text-danger">{t('registerSales.debtUnavailableNotice')}</Text>
          )}
        </View>

        {isCredit && (
          <View className="gap-2.5">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('registerSales.clientForCreditTitle')}</Text>
            <TextInput
              value={customerName}
              onChangeText={setCustomerName}
              placeholder={t('registerSales.customerNamePlaceholder')}
              className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold"
            />
            <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={customerPhone} setPhone={setCustomerPhone} label={t('registerSales.customerPhoneLabel')} />
          </View>
        )}

        <View className="flex-row items-center justify-between p-[18px] rounded-2xl bg-[#F4E3DE] mb-2">
          <Text className="text-[15px] font-bold text-[#7A3A26]">{t('registerSales.amountToRefund')}</Text>
          <Text className="amount text-2xl font-extrabold text-[#8F3B23]">{total.toLocaleString('fr-FR')} {tenant.currency}</Text>
        </View>
      </ScrollView>

      <View className="px-5 pt-3 pb-9 gap-2.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable onPress={handleSubmit} disabled={!canSubmit} className="w-full h-[62px] rounded-[18px] bg-terracotta items-center justify-center disabled:opacity-40">
          <Text className="text-papier text-lg font-extrabold">
            {submitting ? t('registerSales.recording') : anySelected ? t('registerSales.validateReturn', { amount: total.toLocaleString('fr-FR') }) : t('registerSales.selectAnItem')}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
