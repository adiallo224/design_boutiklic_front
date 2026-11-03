import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary: 'bg-primary text-papier hover:bg-primary-dark disabled:opacity-40',
  secondary: 'border border-border-strong bg-bg-card text-text hover:bg-bg-elevated disabled:opacity-40',
  ghost: 'text-text hover:bg-bg-elevated disabled:opacity-40',
  danger: 'bg-danger text-papier hover:opacity-90 disabled:opacity-40',
  /** Couleur de l'item de menu actif du Sidebar (bg-terracotta text-white) — pour les CTA
   *  "Ajouter/Nouveau…" qui doivent visuellement matcher la nav bureau. */
  accent: 'bg-terracotta text-white hover:opacity-90 disabled:opacity-40',
}

/** Primitive bouton bureau minimale — le mobile n'en a aucune (classes Tailwind à la main sur
 *  chaque écran) ; introduite ici car les écrans bureau sont majoritairement des formulaires. */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', loading, disabled, className = '', children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`h-11 px-5 rounded-xl font-extrabold text-sm transition-colors ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {loading ? '…' : children}
    </button>
  )
})

export default Button
