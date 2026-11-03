import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AuthCenteredCard from './AuthCenteredCard'

interface RecoveryPinEntryDesktopProps {
  pin: string[]
  onBack: () => void
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
  loading?: boolean
  error?: string | null
}

const PIN_LENGTH = 6

/** Étape "code de récupération" du parcours mot de passe oublié — pas de numéro W dédié, écran
 *  connectif nécessaire à la complétude du flux sur bureau (cf. RecoveryPinEntry.tsx, mobile). */
export default function RecoveryPinEntryDesktop({ pin, onBack, onDigit, onClear, onConfirm, loading = false, error = null }: RecoveryPinEntryDesktopProps) {
  const { t } = useTranslation()
  const canConfirm = !loading && pin.length === PIN_LENGTH
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[Math.min(pin.length, PIN_LENGTH - 1)]?.focus()
  }, [pin.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (pin.length > 0) onClear()
      return
    }
    if (e.key === 'Enter' && canConfirm) {
      onConfirm()
      return
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      if (i === pin.length) onDigit(e.key)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, PIN_LENGTH)
    for (let i = pin.length; i < digits.length; i++) onDigit(digits[i])
  }

  return (
    <AuthCenteredCard title={t('auth.recoveryCodeTitle')} subtitle={t('auth.recoveryCodeSubtitle')} onBack={onBack} backLabel={t('auth.back')} width={460}>
      <div className="flex gap-1.5 min-[400px]:gap-2 justify-center py-2" onPaste={handlePaste}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = pin[i]
          const active = i === pin.length && pin.length < PIN_LENGTH
          return (
            <input
              key={i}
              ref={(el) => {
                inputRefs.current[i] = el
              }}
              value={filled ?? ''}
              onChange={() => undefined}
              onKeyDown={(e) => handleKeyDown(e, i)}
              inputMode="numeric"
              maxLength={1}
              className={`flex-1 min-w-0 max-w-11 h-14 min-[400px]:h-[62px] rounded-xl text-center text-xl min-[400px]:text-2xl font-extrabold amount outline-none ${
                active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
              }`}
            />
          )
        })}
      </div>

      <div className="text-[13px] font-semibold text-text-muted text-center">{t('auth.forgotCodeToo')}</div>

      {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

      <button
        type="button"
        onClick={canConfirm ? onConfirm : undefined}
        disabled={!canConfirm}
        className="min-h-12 py-2 rounded-xl bg-primary text-papier text-base font-extrabold flex items-center justify-center disabled:opacity-40"
      >
        {loading ? t('auth.verifying') : t('components.confirm')}
      </button>
    </AuthCenteredCard>
  )
}
