import { useState } from 'react'
import { ChevronLeft, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface ResetPasswordProps {
  onSubmit: (password: string) => void
  onBack: () => void
  loading?: boolean
  error?: string | null
}

export default function ResetPassword({ onSubmit, onBack, loading = false, error = null }: ResetPasswordProps) {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !loading && password.length >= 8 && confirmPassword.length > 0 && !passwordsMismatch

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.newPasswordTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.resetLastStep')}</div>
        </div>
      </div>

      <div className="flex-none px-[22px] pb-[22px]">
        <div className="h-1 rounded-full bg-fond-planche">
          <div className="h-1 rounded-full bg-primary" style={{ width: '100%' }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-4 pt-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.newPasswordLabel')}</div>
          <div className="h-[58px] rounded-2xl border border-border-strong bg-bg flex items-center px-[18px] gap-3">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 text-lg font-extrabold tracking-[.14em] outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              disabled={password.length === 0}
              className="text-text-dim disabled:opacity-40"
            >
              {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {password.length > 0 && password.length < 8 && (
            <div className="text-[13px] font-semibold text-danger">{t('auth.passwordMinLength')}</div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmNewPasswordLabel')}</div>
          <div className={`h-[58px] rounded-2xl border bg-bg flex items-center px-[18px] gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••"
              className="flex-1 text-lg font-extrabold tracking-[.14em] outline-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((s) => !s)}
              disabled={confirmPassword.length === 0}
              className="text-text-dim disabled:opacity-40"
            >
              {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
            </button>
          </div>
          {passwordsMismatch && <div className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</div>}
        </div>
      </div>

      <div className="flex-none px-[22px] pb-5 flex flex-col gap-3.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={() => canSubmit && onSubmit(password)}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-primary text-papier text-lg font-extrabold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? t('auth.saving') : t('auth.validate')}
        </button>
      </div>
    </div>
  )
}
