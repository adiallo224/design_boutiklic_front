import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthCenteredCard from './AuthCenteredCard'

interface ResetPasswordDesktopProps {
  onSubmit: (password: string) => void
  onBack: () => void
  loading?: boolean
  error?: string | null
}

/** Dernier écran du parcours "mot de passe oublié" (W25) — pas de numéro W dédié, écran connectif
 *  nécessaire à la complétude du flux sur bureau. */
export default function ResetPasswordDesktop({ onSubmit, onBack, loading = false, error = null }: ResetPasswordDesktopProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !loading && password.length >= 8 && confirmPassword.length > 0 && !passwordsMismatch

  return (
    <AuthCenteredCard title={t('auth.newPasswordTitle')} subtitle={t('auth.resetLastStep')} onBack={onBack} backLabel={t('auth.back')} width={440}>
      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.newPasswordLabel')}</span>
        <div className="h-11 rounded-xl border border-border-strong bg-bg flex items-center px-4 gap-3">
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="flex-1 min-w-0 text-base font-extrabold tracking-[.14em] outline-none bg-transparent"
          />
          <button type="button" onClick={() => setShowPassword((s) => !s)} disabled={password.length === 0} className="text-text-dim disabled:opacity-40">
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {password.length > 0 && password.length < 8 && <span className="text-[13px] font-semibold text-danger">{t('auth.passwordMinLength')}</span>}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmNewPasswordLabel')}</span>
        <div className={`h-11 rounded-xl border bg-bg flex items-center px-4 gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="flex-1 min-w-0 text-base font-extrabold tracking-[.14em] outline-none bg-transparent"
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && onSubmit(password)}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((s) => !s)}
            disabled={confirmPassword.length === 0}
            className="text-text-dim disabled:opacity-40"
          >
            {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
        {passwordsMismatch && <span className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</span>}
      </div>

      {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

      <button
        type="button"
        onClick={() => canSubmit && onSubmit(password)}
        disabled={!canSubmit}
        className="min-h-12 py-2 rounded-xl bg-primary text-papier text-base font-extrabold flex items-center justify-center disabled:opacity-50"
      >
        {loading ? t('auth.saving') : t('auth.validate')}
      </button>
    </AuthCenteredCard>
  )
}
