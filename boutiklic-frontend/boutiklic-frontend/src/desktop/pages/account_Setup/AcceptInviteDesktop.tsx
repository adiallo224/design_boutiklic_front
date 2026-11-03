import { useState } from 'react'
import { Eye, EyeOff, UserCheck } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ROLE_KEYS: Record<string, string> = {
  SELLER: 'settings.role.seller',
  APPRENTICE: 'settings.role.apprentice',
  SUPERVISOR: 'settings.role.supervisor',
  OWNER: 'settings.role.owner',
}

interface AcceptInviteDesktopProps {
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

/** W12 — deux colonnes : récapitulatif de l'invitation à gauche (boutique, rôle — "invité par" et
 *  le détail des accès par rôle ne sont pas exposés par AcceptInvite/getTenantInviteSummary
 *  aujourd'hui, on n'affiche que ce que l'API fournit réellement), formulaire nom + mot de passe à
 *  droite. Aucune boutique n'est créée ici (cf. AcceptInvite.tsx, mobile). */
export default function AcceptInviteDesktop({
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
}: AcceptInviteDesktopProps) {
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
    <div className="min-h-dvh lg:h-dvh flex bg-bg">
      <div className="w-[440px] shrink-0 hidden lg:flex flex-col gap-6 p-10 bg-bg-card border-r border-border">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-success flex items-center justify-center flex-none">
            <UserCheck size={21} className="text-papier" strokeWidth={2.4} />
          </div>
          <div className="flex flex-col gap-0.5">
            <div className="text-lg font-extrabold tracking-tight">{t('auth.activateAccountTitle')}</div>
            <div className="text-[13px] font-extrabold text-success">{t('auth.invitationRecognized')}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-[#F7EFE3] border border-border-strong">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-11 h-11 rounded-2xl object-cover flex-none" />
          ) : (
            <div
              className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center flex-none"
              style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(230,157,59,.3) 0 3px,transparent 3px 11px)' }}
            >
              <div className="w-4 h-4 rounded border-[3px] border-papier" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
            </div>
          )}
          <div className="flex-1 min-w-0 flex flex-col gap-0.5">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.youAreJoining')}</div>
            <div className="text-base font-extrabold tracking-tight truncate">{boutiqueName ?? t('common.loading')}</div>
          </div>
          <div className="flex-none px-3 py-1.5 rounded-full bg-info-bg text-primary text-[13px] font-bold">
            {ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}
          </div>
        </div>

        <div className="text-[13px] leading-relaxed text-text-muted">{t('auth.acceptInviteExplainer')}</div>

        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-succes-bg border border-[#CBE1D7]">
          <div className="text-[13px] leading-relaxed text-succes-text">{t('auth.joiningExistingShopNotice')}</div>
        </div>
      </div>

      <div className="flex-1 min-w-0 flex items-center justify-center px-4 sm:px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-[400px] flex flex-col gap-5">
          <div className="lg:hidden flex items-center gap-3 p-3 rounded-2xl bg-[#F7EFE3] border border-border-strong">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="text-[11px] font-extrabold tracking-widest text-text-dim">{t('auth.youAreJoining')}</div>
              <div className="text-base font-extrabold tracking-tight break-words">{boutiqueName ?? t('common.loading')}</div>
            </div>
            <div className="flex-none px-2.5 py-1 rounded-full bg-info-bg text-primary text-xs font-bold">
              {ROLE_KEYS[role] ? t(ROLE_KEYS[role]) : role}
            </div>
          </div>
          <h1 className="font-display text-xl min-[400px]:text-2xl font-extrabold tracking-tight text-text">{t('auth.activateAccountTitle')}</h1>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.yourNameLabel')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Aissatou Baldé"
              className="h-11 rounded-xl border-2 border-success bg-bg px-4 text-base font-bold outline-none"
            />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.passwordLabel')}</span>
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
            <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmPasswordLabel')}</span>
            <div className={`h-11 rounded-xl border bg-bg flex items-center px-4 gap-3 ${passwordsMismatch ? 'border-danger' : 'border-border-strong'}`}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.repeatPasswordPlaceholder')}
                className="flex-1 min-w-0 text-base font-extrabold tracking-[.14em] outline-none bg-transparent"
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && onActivate()}
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
            onClick={onActivate}
            disabled={!canSubmit}
            className="min-h-12 py-2 rounded-xl bg-success text-papier text-base font-extrabold flex items-center justify-center disabled:opacity-50"
          >
            {loading ? t('auth.activating') : t('auth.activateAccountButton')}
          </button>

          <div className="text-center text-sm font-semibold text-text-muted">
            {t('auth.notYouQuestion')}{' '}
            <button type="button" onClick={onChangeNumber} className="text-terracotta font-bold">
              {t('auth.changeNumberLink')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
