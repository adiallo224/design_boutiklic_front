import { ChevronLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface RecoveryPinEntryProps {
  pin: string[]
  onBack: () => void
  onDigit: (d: string) => void
  onClear: () => void
  onConfirm: () => void
  loading?: boolean
  error?: string | null
}

/** Dernière vérification avant le nouveau mot de passe (écran "Mot de passe oublié") — exigée
 *  seulement quand le compte a configuré un code de récupération (cf. AuthFlow.tsx, TenantMembership.hasRecoveryPin).
 *  La vérification réelle a lieu côté serveur lors de l'appel resetPassword ; ce clavier ne fait
 *  que collecter les 6 chiffres. */
export default function RecoveryPinEntry({ pin, onBack, onDigit, onClear, onConfirm, loading = false, error = null }: RecoveryPinEntryProps) {
  const { t } = useTranslation()
  const canConfirm = !loading && pin.length === 6

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.recoveryCodeTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.recoveryCodeSubtitle')}</div>
        </div>
      </div>
      <div className="flex-none px-[22px] pb-5">
        <div className="h-1 rounded-full bg-fond-planche">
          <div className="h-1 rounded-full bg-primary" style={{ width: '92%' }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col justify-center gap-6 overflow-y-auto no-scrollbar">
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4, 5].map((i) => {
            const filled = pin[i]
            const active = i === pin.length && pin.length < 6
            return (
              <div
                key={i}
                className={`flex-1 h-[62px] rounded-2xl flex items-center justify-center text-2xl font-extrabold amount ${
                  active ? 'border-2 border-warning bg-alerte-bg' : filled ? 'border-2 border-primary bg-bg-card' : 'border border-border-strong bg-bg'
                }`}
              >
                {filled ?? (active ? <div className="w-0.5 h-[24px] bg-encre" /> : '')}
              </div>
            )
          })}
        </div>

        <div className="text-[13px] font-semibold text-text-muted text-center">
          {t('auth.forgotCodeToo')}
        </div>

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
