import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ label, error, className = '', id, ...rest }, ref) {
  return (
    <label className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-bold text-text-muted uppercase tracking-wide">{label}</span>}
      <input
        ref={ref}
        id={id}
        className={`h-11 px-3.5 rounded-xl border bg-bg font-semibold outline-none focus:border-primary ${
          error ? 'border-danger' : 'border-border-strong'
        } ${className}`}
        {...rest}
      />
      {error && <span className="text-xs text-danger font-semibold">{error}</span>}
    </label>
  )
})

export default Input
