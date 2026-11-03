import { ChevronLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PHONE_COUNTRIES } from '@boutiklic/shared'

const CODE_LENGTH = 6

type Channel = 'phone' | 'email'
type Mode = 'signup' | 'reset'

interface VerifyCodeProps {
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

export default function VerifyCode({
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
}: VerifyCodeProps) {
  const { t } = useTranslation()
  const isReset = mode === 'reset'
  const canConfirm = !loading && otp.length === CODE_LENGTH
  const dialCode = PHONE_COUNTRIES.find((c) => c.id === countryId)?.dialCode ?? '+224'

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">
            {channel === 'phone' ? t('auth.codeReceivedBySms') : t('auth.codeReceivedByEmail')}
          </div>
          <div className="text-[13px] font-semibold text-text-dim">
            {isReset ? t('auth.resetLabel') : t('auth.stepTwoOfThree')}
            {channel === 'phone' ? `${dialCode} ` + (phone || '620 12 34 56') : email || 'mariama.diallo@gmail.com'}
          </div>
        </div>
      </div>
      <div className="flex-none px-[22px] pb-5">
        {isReset ? (
          <div className="h-1 rounded-full bg-fond-planche">
            <div className="h-1 rounded-full bg-primary" style={{ width: '85%' }} />
          </div>
        ) : (
          <div className="h-[5px] rounded-full bg-fond-planche flex gap-1">
            <div className="flex-1 bg-primary rounded-full" />
            <div className="flex-1 bg-primary rounded-full" />
            <div className="flex-1 bg-fond-planche rounded-full" />
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col justify-center gap-6 overflow-y-auto no-scrollbar">
        <div className="flex gap-3">
          {Array.from({ length: CODE_LENGTH }, (_, i) => i).map((i) => {
            const filled = otp[i]
            const active = i === otp.length && otp.length < CODE_LENGTH
            return (
              <div
                key={i}
                className={`flex-1 h-[78px] rounded-2xl flex items-center justify-center text-[34px] font-extrabold amount ${
                  active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
                }`}
              >
                {filled ?? (active ? <div className="w-0.5 h-[34px] bg-encre" /> : '')}
              </div>
            )
          })}
        </div>

        {channel === 'phone' ? (
          <div className="flex items-center justify-between">
            <div className="text-[15px] font-semibold text-text-muted">{t('auth.notReceived')}</div>
            <button
              onClick={resendIn === 0 ? onResend : undefined}
              disabled={resendIn > 0}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold amount ${resendIn > 0 ? 'bg-bg-elevated text-text-muted' : 'bg-primary text-papier cursor-pointer'}`}
            >
              {resendIn > 0 ? t('auth.resendInSeconds', { seconds: resendIn }) : t('auth.resend')}
            </button>
          </div>
        ) : (
          <>
            <div className="text-[15px] font-semibold text-text-muted">{t('auth.notReceivedCheckSpam')}</div>
            <div className="flex justify-end">
              <button
                onClick={resendIn === 0 ? onResend : undefined}
                disabled={resendIn > 0}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold amount ${resendIn > 0 ? 'bg-bg-elevated text-text-muted' : 'bg-primary text-papier cursor-pointer'}`}
              >
                {resendIn > 0 ? t('auth.resendInSeconds', { seconds: resendIn }) : t('auth.resend')}
              </button>
            </div>
          </>
        )}

        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
      </div>

      <div className="flex-none px-4 pb-7">
        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((n) => (
            <button
              key={n}
              onClick={() => onDigit(n)}
              className="h-[58px] rounded-2xl bg-bg border border-border text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
            >
              {n}
            </button>
          ))}
          <button onClick={onClear} className="h-[58px] rounded-2xl text-terracotta text-sm font-bold flex items-center justify-center">
            {t('auth.clear')}
          </button>
          <button
            onClick={() => onDigit('0')}
            className="h-[58px] rounded-2xl bg-bg border border-border text-2xl font-bold flex items-center justify-center active:scale-95 transition-transform"
          >
            0
          </button>
          <button
            onClick={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            className="h-[58px] rounded-2xl bg-primary flex items-center justify-center disabled:opacity-40 active:scale-95 transition-transform"
          >
            <Check size={24} strokeWidth={2.6} className="text-papier" />
          </button>
        </div>
      </div>
    </div>
  )
}
