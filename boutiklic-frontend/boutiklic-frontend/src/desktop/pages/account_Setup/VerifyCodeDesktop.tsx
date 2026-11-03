import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import AuthCenteredCard from './AuthCenteredCard'
import { PHONE_COUNTRIES } from '@boutiklic/shared'

type Channel = 'phone' | 'email'
type Mode = 'signup' | 'reset'

interface VerifyCodeDesktopProps {
  channel: Channel
  countryId: string
  phone: string
  email: string
  otp: string[]
  resendIn: number
  onBack: () => void
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
  mode?: Mode
  onResend?: () => void
  loading?: boolean
  error?: string | null
}

const CODE_LENGTH = 6

/** W11 — écran centré, cases de code avec clavier physique (pas de pavé numérique tactile, cf.
 *  "Comportements bureau à implémenter"). Le code fait 6 chiffres côté backend (cf. AuthFlow.tsx,
 *  otp.length < 6) — on suit la vraie longueur acceptée par authApi.verifyOtp. */
export default function VerifyCodeDesktop({
  channel,
  countryId,
  phone,
  email,
  otp,
  resendIn,
  onBack,
  onDigit,
  onClear,
  onConfirm,
  mode = 'signup',
  onResend,
  loading = false,
  error = null,
}: VerifyCodeDesktopProps) {
  const { t } = useTranslation()
  const isReset = mode === 'reset'
  const canConfirm = !loading && otp.length === CODE_LENGTH
  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputRefs.current[Math.min(otp.length, CODE_LENGTH - 1)]?.focus()
  }, [otp.length])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      // Le focus suit toujours otp.length (cf. effet ci-dessus) : peu importe la case i, on efface
      // toujours le dernier chiffre saisi.
      if (otp.length > 0) onClear()
      return
    }
    if (e.key === 'Enter' && canConfirm) {
      onConfirm()
      return
    }
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault()
      if (i === otp.length) onDigit(e.key)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    for (let i = otp.length; i < digits.length; i++) onDigit(digits[i])
  }

  return (
    <AuthCenteredCard
      title={channel === 'phone' ? t('auth.codeReceivedBySms') : t('auth.codeReceivedByEmail')}
      subtitle={
        (isReset ? t('auth.resetLabel') : t('auth.stepTwoOfThree')) +
        (channel === 'phone' ? `${dialCode} ` + (phone || '620 12 34 56') : email || 'mariama.diallo@gmail.com')
      }
      onBack={onBack}
      backLabel={t('auth.back')}
      width={420}
    >
      <div className="flex gap-1.5 min-[400px]:gap-3 justify-center py-2" onPaste={handlePaste}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const filled = otp[i]
          const active = i === otp.length && otp.length < CODE_LENGTH
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
              className={`flex-1 min-w-0 max-w-[66px] h-14 min-[400px]:h-[78px] rounded-xl min-[400px]:rounded-2xl text-center text-2xl min-[400px]:text-[34px] font-extrabold amount outline-none ${
                active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
              }`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className="text-sm sm:text-[15px] font-semibold text-text-muted min-w-0 break-words">
          {channel === 'phone' ? t('auth.notReceived') : t('auth.notReceivedCheckSpam')}
        </span>
        <button
          type="button"
          onClick={resendIn === 0 ? onResend : undefined}
          disabled={resendIn > 0}
          className={`px-4 py-2.5 rounded-xl text-sm font-bold amount ${resendIn > 0 ? 'bg-bg-elevated text-text-muted' : 'bg-primary text-papier'}`}
        >
          {resendIn > 0 ? t('auth.resendInSeconds', { seconds: resendIn }) : t('auth.resend')}
        </button>
      </div>

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
