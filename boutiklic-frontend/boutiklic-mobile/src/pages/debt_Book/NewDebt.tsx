import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, Keyboard } from 'react-native'
import { ChevronLeft } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE, type Locale } from '@boutiklic/shared'
import NumericKeypad from '../../components/NumericKeypad'
import PhoneNumberField from '../../components/PhoneNumberField'
import { useTenant } from '../../hooks/useTenant'
import { debtApi } from '../../lib/debtApi'
import { toE164Phone } from '../../lib/authApi'
import { PHONE_COUNTRIES, countryIdFromPhone } from '@boutiklic/shared'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import DateField from '../../components/DateField'

interface NewDebtProps {
  onBack: () => void
  onCreated: () => void
}

export default function NewDebt({ onBack, onCreated }: NewDebtProps) {
  const { t, i18n } = useTranslation()
  const locale: Locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [customerName, setCustomerName] = useState('')
  const [countryId, setCountryId] = useState('GN')
  const [customerPhone, setCustomerPhone] = useState('')
  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Préselectionne l'indicatif de la boutique (dérivé de son téléphone déjà enregistré) dès qu'il
  // est connu, plutôt que de rester figé sur la Guinée — cf. countryIdFromPhone.
  useEffect(() => {
    if (tenant.phone) setCountryId(countryIdFromPhone(tenant.phone))
  }, [tenant.phone])

  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'
  const parsedAmount = parseInt(amount.replace(',', '')) || 0
  const invalid = customerName.trim().length === 0 || customerPhone.trim().length < 8 || parsedAmount <= 0

  const handleSubmit = async () => {
    if (invalid || submitting) return
    setSubmitting(true)
    setError(null)
    const payload = {
      customerName: customerName.trim(),
      customerPhone: toE164Phone(customerPhone.trim(), dialCode),
      amount: parsedAmount,
      currency: tenant.currency,
      dueDate: dueDate || undefined,
    }
    try {
      try {
        await debtApi.createDebt(payload)
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts).
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CREATE_DEBT', JSON.stringify(payload))
      }
      onCreated()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Pressable onPress={Keyboard.dismiss} className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('debtBook.newDebtTitle')}</Text>
      </View>

      <View className="px-5 pb-4 gap-3">
        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.clientLabel')}</Text>
          <TextInput
            value={customerName}
            onChangeText={setCustomerName}
            placeholder={t('debtBook.customerNamePlaceholder')}
            className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold"
          />
          <PhoneNumberField countryId={countryId} setCountryId={setCountryId} phone={customerPhone} setPhone={setCustomerPhone} label={t('debtBook.customerPhoneFieldLabel')} />
        </View>

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('debtBook.dueDateLabel')}</Text>
          <DateField
            value={dueDate}
            onChange={setDueDate}
            placeholder={t('debtBook.dueDatePlaceholder')}
            className="h-[52px] rounded-2xl border border-border-strong bg-bg-card px-4 justify-center"
            textClassName="font-semibold"
          />
        </View>
      </View>

      <View className="mx-5 mb-3 p-3.5 rounded-[18px] bg-terracotta gap-1 overflow-hidden relative">
        <DiagonalStripes color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />
        <Text className="text-xs font-extrabold tracking-widest text-papier/65">{t('debtBook.debtAmountLabel')}</Text>
        <Text className="amount text-[32px] font-extrabold text-papier tracking-tight">{formatNumber(parsedAmount, locale)}</Text>
      </View>

      <View className="flex-1 px-4">
        <NumericKeypad
          compact
          onDigit={(d) => setAmount((a) => (a === '0' ? d : a + d))}
          onDecimal={() => setAmount((a) => (a.includes(',') ? a : a + ','))}
          onClear={() => setAmount('')}
          onBackspace={() => setAmount((a) => a.slice(0, -1))}
        />
      </View>

      <View className="px-5 pt-3.5 pb-9 gap-2.5">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable onPress={handleSubmit} disabled={submitting || invalid} className="h-[62px] rounded-[18px] bg-primary items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-lg font-extrabold">{submitting ? t('debtBook.saving') : t('debtBook.createDebt')}</Text>
        </Pressable>
      </View>
    </Pressable>
  )
}
