import { View, Text, TextInput } from 'react-native'
import { useTranslation } from 'react-i18next'
import CountryCodePicker from './CountryCodePicker'

interface PhoneNumberFieldProps {
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  label?: string
  /** 'active' reprend le style de champ mis en avant à l'étape 1 de la création de compte (bordure
   *  primary épaisse, cf. le champ email de CreateAccount) ; 'default' est le style neutre utilisé
   *  sur Login et ForgotPassword. */
  variant?: 'default' | 'active'
}

/** Champ "indicatif + numéro" partagé par Login, CreateAccount et ForgotPassword — même sélecteur
 *  de pays (CountryCodePicker), même séparateur, même saisie. */
export default function PhoneNumberField({
  countryId,
  setCountryId,
  phone,
  setPhone,
  label,
  variant = 'default',
}: PhoneNumberFieldProps) {
  const { t } = useTranslation()
  return (
    <View className="gap-2">
      <Text className="text-xs font-extrabold tracking-widest text-text-dim">{label ?? t('components.phoneField.label')}</Text>
      <View
        className={`h-[60px] rounded-2xl flex-row items-center px-[18px] gap-3 ${
          variant === 'active' ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
        }`}
      >
        <CountryCodePicker countryId={countryId} setCountryId={setCountryId} />
        <View className="w-px h-6 bg-border-strong" />
        <TextInput
          value={phone}
          onChangeText={(v) => setPhone(v.replace(/\D/g, ''))}
          placeholder="620 12 34 56"
          keyboardType="phone-pad"
          className="amount flex-1 text-xl font-extrabold tracking-wide"
        />
      </View>
    </View>
  )
}
