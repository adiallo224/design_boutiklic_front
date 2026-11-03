import { TextInput, type TextInputProps } from 'react-native'
import { sanitizeMoneyInput } from '@boutiklic/shared'

interface MoneyInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'keyboardType'> {
  /** Valeur courante, forme canonique : chiffres et, si `decimals` > 0, un point décimal (ex. « 333.33 »). */
  value: string
  /** Reçoit la valeur déjà nettoyée. */
  onValueChange: (next: string) => void
  /** Décimales autorisées : celles de la devise (`currencyDecimals(tenant.currency)`), ou la précision des prix de vente
   *  réglable par boutique (phase 5bis). 0 = entiers uniquement, comme l'ancien champ de prix. */
  decimals: number
}

/**
 * Champ de prix / de montant (étude prix décimaux, phase 5) — pendant mobile de desktop/components/MoneyInput. Clavier
 * numérique avec séparateur décimal quand la devise a des décimales ; strictement identique à l'ancien champ à 0 décimale.
 * Les champs de QUANTITÉ restent des entiers : ils n'utilisent pas ce composant.
 */
export default function MoneyInput({ value, onValueChange, decimals, ...rest }: MoneyInputProps) {
  return (
    <TextInput
      {...rest}
      value={value}
      keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
      onChangeText={(next: string) => onValueChange(sanitizeMoneyInput(next, decimals))}
    />
  )
}
