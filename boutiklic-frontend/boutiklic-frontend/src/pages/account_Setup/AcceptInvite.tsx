import { useState } from 'react'
import { Eye, EyeOff, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ROLE_KEYS: Record<string, string> = {
  SELLER: 'settings.role.seller',
  APPRENTICE: 'settings.role.apprentice',
  SUPERVISOR: 'settings.role.supervisor',
  OWNER: 'settings.role.owner',
}

interface AcceptInviteProps {
  boutiqueName: string | null
  logoUrl: string | null
  role: string
  name: string
  setName: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onActivate: () => void
  onChangeNumber: () => void
  loading?: boolean
  error?: string | null
}

/** Écran A3e — Activer mon compte (invité reconnu) : dernière étape, pas de création de boutique
 * (cf. study/BOUTIKLIC Interfaces.dc.md). Atteint depuis AuthFlow.handleConfirmOtp quand l'OTP
 * vérifié correspond à un membre PENDING_ACTIVATION (credentialAlreadySet: false). */
export default function AcceptInvite({
  boutiqueName,
  logoUrl,
  role,
  name,
  setName,
  password,
  setPassword,
  onActivate,
  onChangeNumber,
  loading = false,
  error = null,
}: AcceptInviteProps) {
  const { t } = useTranslation()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  function passwordStrength(password: string): { label: string; segments: 0 | 1 | 2 } | null {
    if (password.length === 0) return null
    if (password.length < 8) return { label: t('auth.passwordStrengthTooShort'), segments: 0 }
    const varied = /[A-Z]/.test(password) && /[0-9]/.test(password)
    return varied ? { label: t('auth.passwordStrengthGood'), segments: 2 } : { label: t('auth.passwordStrengthWeak'), segments: 1 }
  }

  const strength = passwordStrength(password)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit = !loading && name.trim().length > 0 && password.length >= 8 && confirmPassword.length > 0 && !passwordsMismatch

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <div className="w-11 h-11 rounded-2xl bg-success flex items-center justify-center flex-none">
          <UserCheck size={21} className="text-papier" strokeWidth={2.4} />
        </div>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.activateAccountTitle')}</div>
          <div className="text-[13px] font-extrabold text-success">{t('auth.invitationRecognized')}</div>
        </div>
      </div>

      <div className="flex-none px-[22px] pb-[22px]">
        <div className="h-1 rounded-full bg-fond-planche">
          <div className="h-1 rounded-full bg-success" style={{ width: '100%' }} />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-4 pt-1 overflow-y-auto no-scrollbar">
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F7EFE3] border border-border-strong">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-[46px] h-[46px] rounded-[14px] object-cover flex-none" />
          ) : (
            <div
              className="w-[46px] h-[46px] rounded-[14px] bg-primary flex items-center justify-center flex-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(230,157,59,.3) 0 3px,transparent 3px 11px)' }}
            >
              <div className="w-4 h-4 rounded border-[3px] border-papier" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.youAreJoining')}</div>
            <div className="text-[17px] font-extrabold tracking-tight truncate">{boutiqueName ?? t('common.loading')}</div>
          </div>
          <div className="flex-none px-3 py-1.5 rounded-full bg-info-bg text-primary text-[13px] font-bold">
            {ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}
          </div>
        </div>

        <div className="p-4 rounded-[22px] bg-papier border border-border-strong flex flex-col gap-4">
          <div className="text-[13px] leading-relaxed text-text-muted">
            {t('auth.acceptInviteExplainer')}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.yourNameLabel')}</div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aissatou Baldé"
              className="h-[58px] rounded-2xl border-2 border-success bg-bg px-[18px] text-lg font-bold outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.passwordLabel')}</div>
            <div className="h-[58px] rounded-2xl border border-border-strong bg-bg flex items-center px-[18px] gap-3">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="flex-1 text-lg font-extrabold tracking-[.14em] outline-none bg-transparent"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} disabled={password.length === 0} className="text-text-dim disabled:opacity-40">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {strength && (
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {[0, 1].map((i) => (
                    <div key={i} className={`flex-1 h-[5px] rounded-full ${i < strength.segments ? 'bg-success' : 'bg-fond-planche'}`} />
                  ))}
                </div>
                <div className={`text-[12px] font-bold ${strength.segments === 2 ? 'text-success' : 'text-text-dim'}`}>{strength.label}</div>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmPasswordLabel')}</div>
            <div className={`h-[58px] rounded-2xl border bg-bg flex items-center px-[18px] gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.repeatPasswordPlaceholder')}
                className="flex-1 text-lg font-extrabold tracking-[.14em] outline-none bg-transparent"
              />
              <button type="button" onClick={() => setShowConfirmPassword((s) => !s)} disabled={confirmPassword.length === 0} className="text-text-dim disabled:opacity-40">
                {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {passwordsMismatch && <div className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</div>}
          </div>
        </div>

        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-succes-bg border border-[#CBE1D7]">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1F5C43" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
            <circle cx="12" cy="12" r="9" />
            <path d="m8.5 12.5 2.2 2.2L16 10" />
          </svg>
          <div className="text-[13px] leading-relaxed text-succes-text">
            {t('auth.joiningExistingShopNotice')}
          </div>
        </div>
      </div>

      <div className="flex-none px-[22px] pb-5 flex flex-col gap-3.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={onActivate}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-success text-papier text-lg font-extrabold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? t('auth.activating') : t('auth.activateAccountButton')}
        </button>
        <div className="text-center text-sm font-semibold text-text-muted">
          {t('auth.notYouQuestion')} <span onClick={onChangeNumber} className="text-terracotta font-bold cursor-pointer">{t('auth.changeNumberLink')}</span>
        </div>
      </div>
    </div>
  )
}
