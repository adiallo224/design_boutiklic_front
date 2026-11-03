import { View, Text, Pressable } from 'react-native'
import { Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

interface TaxChoiceProps {
  applyTax: boolean
  setApplyTax: (value: boolean) => void
}

/**
 * Création de boutique : « Appliquez-vous la TVA à vos ventes ? ». Non par défaut — la plupart des petites boutiques de quartier ne sont
 * pas assujetties : leurs prix restent ceux affichés, sans bloc de TVA sur le ticket. Oui déclenche l'amorçage du taux officiel du pays
 * (s'il y en a un) ; les taux se règlent ensuite dans Réglages → TVA. À ne pas confondre avec un taux à 0 %, qui est une TVA appliquée à 0.
 */
export default function TaxChoice({ applyTax, setApplyTax }: TaxChoiceProps) {
  const { t } = useTranslation()
  const options = [
    { value: false, label: t('auth.taxChoiceNo'), desc: t('auth.taxChoiceNoDesc') },
    { value: true, label: t('auth.taxChoiceYes'), desc: t('auth.taxChoiceYesDesc') },
  ]
  return (
    <View className="gap-2.5" accessibilityRole="radiogroup">
      <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.taxChoiceLabel')}</Text>
      <Text className="text-sm font-bold">{t('auth.taxChoiceQuestion')}</Text>
      {options.map((o) => {
        const active = applyTax === o.value
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => setApplyTax(o.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            className={`flex-row items-center gap-3.5 p-4 rounded-[17px] ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
          >
            <View className={`w-[22px] h-[22px] rounded-full items-center justify-center ${active ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
              {active && <Check size={13} strokeWidth={3.6} color="#FFFDFA" />}
            </View>
            <View className="flex-1 gap-0.5">
              <Text className={`text-base ${active ? 'font-extrabold text-primary' : 'font-bold'}`}>{o.label}</Text>
              <Text className={`text-[13px] ${active ? 'text-[#33465E]' : 'text-text-dim'}`}>{o.desc}</Text>
            </View>
          </Pressable>
        )
      })}
      <Text className="text-xs text-text-muted">{t('auth.taxChoiceLater')}</Text>
    </View>
  )
}
