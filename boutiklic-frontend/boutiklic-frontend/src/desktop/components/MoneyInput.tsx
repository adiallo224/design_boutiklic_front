import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { sanitizeMoneyInput } from '@boutiklic/shared'
import Input from './Input'

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'inputMode'> {
  label?: string
  error?: string
  /** Valeur courante, forme canonique : chiffres et, si `decimals` > 0, un point décimal (ex. « 333.33 »). */
  value: string
  /** Reçoit la valeur déjà nettoyée — jamais l'événement brut. */
  onValueChange: (next: string) => void
  /** Décimales autorisées : celles de la devise (`currencyDecimals(tenant.currency)`), ou la précision des prix de vente
   *  réglable par boutique (phase 5bis). 0 = entiers uniquement, comme l'ancien champ de prix. */
  decimals: number
}

/**
 * Champ de prix / de montant (étude prix décimaux, phase 5). Remplace le motif dupliqué
 * `onChange={(e) => set(e.target.value.replace(/[^0-9]/g, ''))} inputMode="numeric"` : accepte la virgule ou le point quand
 * la devise a des décimales, et reste strictement identique à l'ancien champ à 0 décimale (cf. sanitizeMoneyInput).
 * Les champs de QUANTITÉ restent des entiers : ils n'utilisent pas ce composant.
 */
const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, decimals, className = '', ...rest },
  ref,
) {
  return (
    <Input
      {...rest}
      ref={ref}
      value={value}
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      className={`amount ${className}`.trim()}
      onChange={(e) => onValueChange(sanitizeMoneyInput(e.target.value, decimals))}
    />
  )
})

export default MoneyInput
