import { View, Pressable, Text } from 'react-native'
import { Delete } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'

interface NumericKeypadProps {
  onDigit: (digit: string) => void
  onDecimal?: () => void
  onClear: () => void
  onBackspace: () => void
  /** Pavé resserré pour les écrans où le CTA sous le clavier risque de masquer la dernière ligne
   *  (ex. Nouvelle dette, qui empile aussi des champs client + une échéance au-dessus). */
  compact?: boolean
}

export default function NumericKeypad({ onDigit, onDecimal, onClear, onBackspace, compact = false }: NumericKeypadProps) {
  const { t } = useTranslation()
  const gapClass = compact ? 'gap-2' : 'gap-2.5'
  const keyHeight = compact ? 'h-11' : 'h-14'
  const digitKeyClass = `${keyHeight} rounded-2xl bg-bg-card border border-border items-center justify-center active:scale-95`
  const digitTextClass = compact ? 'text-2xl font-bold' : 'text-[28px] font-bold'

  return (
    <View className={gapClass}>
      <View className={`flex-row flex-wrap ${gapClass}`}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
          <Pressable key={n} onPress={() => onDigit(n)} className={`${digitKeyClass} w-[31%]`}>
            <Text className={digitTextClass}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View className={`flex-row ${gapClass}`}>
        <Pressable onPress={onClear} className={`flex-1 ${keyHeight} rounded-2xl bg-[#F4E3DE] items-center justify-center active:scale-95`}>
          <Text className="text-terracotta text-base font-extrabold">{t('components.keypad.clear')}</Text>
        </Pressable>
        <Pressable onPress={onDecimal} className={`${digitKeyClass} flex-1`}>
          <Text className={compact ? 'text-2xl leading-none' : 'text-[34px] leading-none'}>,</Text>
        </Pressable>
        <Pressable onPress={() => onDigit('0')} className={`${digitKeyClass} flex-1`}>
          <Text className={digitTextClass}>0</Text>
        </Pressable>
        <Pressable onPress={onBackspace} className={`${digitKeyClass} flex-1`}>
          <Delete size={compact ? 18 : 22} color="#111418" />
        </Pressable>
      </View>
    </View>
  )
}
