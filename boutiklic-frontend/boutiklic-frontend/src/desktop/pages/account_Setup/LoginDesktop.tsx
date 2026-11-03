import { useState } from 'react'
import { Smartphone, Mail, Eye, EyeOff, Fingerprint, ArrowRight, ChevronDown, IdCard } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthDesktopShell, { ShellSecurityFootnote } from './AuthDesktopShell'
import CountryCodePicker from '../../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface LoginDesktopProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onLogin: () => void
  onSwitchToSignup: () => void
  onForgotPassword: () => void
  onFingerprintLogin?: () => void
  fingerprintLoading?: boolean
  loading?: boolean
  error?: string | null
}

/** W2 — refonte visuelle (étude study/connexion_web/code.html). La coquille (bandeau de progression
 *  + carte unique centrée + pied de page) vit désormais dans AuthDesktopShell, partagée avec
 *  CreateAccountDesktop — voir sa javadoc pour les écarts assumés vis-à-vis du mockup (nav
 *  "Vérification"/"Configuration Magasin" muette, pas de bandeau "Boutique active", "Code PIN
 *  Terminal Caisse" désactivé). Le sélecteur de pays (CountryCodePicker, liste mondiale) est
 *  fonctionnel — le mockup, lui, n'a qu'un &lt;select&gt; figé à 5 indicatifs. Même logique
 *  fonctionnelle que l'ancien fichier — pas de changement de comportement de connexion (cf.
 *  AuthFlow.tsx, branchement isDesktop).
 *
 *  Ajout conservé (absent du mockup) : le bouton empreinte WebAuthn, fonctionnalité réelle déjà
 *  câblée par AuthFlow.tsx — retirer un accès existant aurait été une régression. */
export default function LoginDesktop({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  password,
  setPassword,
  onLogin,
  onSwitchToSignup,
  onForgotPassword,
  onFingerprintLogin,
  fingerprintLoading = false,
  loading = false,
  error = null,
}: LoginDesktopProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const canSubmit = !loading && password.trim().length > 0 && (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)

  return (
    <AuthDesktopShell active="login" onNavigateLogin={() => undefined} onNavigateSignup={onSwitchToSignup}>
      <div className="w-full max-w-[420px] flex flex-col">
        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-info-bg text-primary text-[11px] font-extrabold uppercase tracking-wide mb-3">
            <ArrowRight size={12} /> {t('auth.portalBadge')}
          </div>
          <h2 className="font-serif text-2xl min-[400px]:text-3xl sm:text-4xl font-bold tracking-tight text-text mb-1.5">{t('auth.loginButton')}</h2>
          <p className="text-sm font-semibold text-text-muted">
            {t('auth.noAccountYet')}{' '}
            <button type="button" onClick={onSwitchToSignup} className="text-terracotta font-extrabold inline-flex items-center gap-0.5">
              {t('auth.createShopLink')} <ArrowRight size={13} />
            </button>
          </p>
        </div>

        <div className="p-1 rounded-2xl bg-bg-elevated mb-5 flex flex-wrap items-center gap-1">
          <button
            type="button"
            onClick={() => setChannel('phone')}
            className={`flex-1 min-w-[120px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${channel === 'phone' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
          >
            <Smartphone size={16} /> {t('auth.channelPhone')}
          </button>
          <button
            type="button"
            onClick={() => setChannel('email')}
            className={`flex-1 min-w-[120px] min-h-10 py-1 px-2 rounded-lg flex items-center justify-center gap-2 text-sm transition-all ${channel === 'email' ? 'bg-bg-card text-primary font-extrabold shadow-sm' : 'text-text-muted font-semibold'}`}
          >
            <Mail size={16} /> {t('auth.channelEmail')}
          </button>
        </div>

        <div className="flex flex-col gap-5">
          {channel === 'phone' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-extrabold text-text">{t('auth.phoneNumberLabel')}</span>
                <span className="amount text-xs font-semibold text-text-dim">{t('auth.operatorPrefixHint')}</span>
              </div>
              <div className="flex rounded-2xl border border-border bg-bg-elevated/30 shadow-sm focus-within:border-primary focus-within:bg-bg-card focus-within:ring-2 focus-within:ring-primary/10 transition-all">
                <div className="flex items-center px-3.5 border-r border-border bg-bg-card flex-none rounded-l-2xl">
                  <CountryCodePicker countryId={countryId} setCountryId={setCountryId} />
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="620 12 34 56"
                  inputMode="numeric"
                  className="amount flex-1 min-w-0 bg-transparent px-4 py-3 text-base font-extrabold tracking-wide outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && onLogin()}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-text">{t('auth.emailAddressLabel')}</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gerant@madina-distribution.gn"
                className="h-12 rounded-2xl px-4 text-base font-extrabold outline-none bg-bg-card shadow-sm focus:ring-2 focus:ring-primary focus:ring-offset-1"
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && onLogin()}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
              <span className="text-sm font-extrabold text-text">{t('auth.passwordLabel')}</span>
              <button type="button" onClick={onForgotPassword} className="text-[13px] font-bold text-terracotta hover:underline">
                {t('auth.forgotPasswordLink')}
              </button>
            </div>
            <div className="flex items-center rounded-2xl bg-bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="flex-1 min-w-0 bg-transparent px-4 py-3 text-base font-extrabold tracking-widest outline-none"
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && onLogin()}
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} disabled={password.length === 0} className="p-3 text-text-dim hover:text-text disabled:opacity-40">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none text-sm font-semibold text-text-muted">
            <input type="checkbox" defaultChecked className="w-[18px] h-[18px] mt-0.5 flex-none rounded accent-primary" />
            {t('auth.stayLoggedIn')}
          </label>

          {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

          <button
            type="button"
            onClick={onLogin}
            disabled={!canSubmit}
            className="w-full min-h-14 py-2 rounded-2xl bg-primary text-papier text-base font-extrabold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all active:scale-[0.99] shadow-lg disabled:opacity-50"
          >
            {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            {!loading && <ArrowRight size={18} />}
          </button>

          {onFingerprintLogin && (
            <button
              type="button"
              onClick={onFingerprintLogin}
              disabled={fingerprintLoading}
              className="flex items-center justify-center gap-2.5 min-h-11 py-1 rounded-xl border border-border-strong text-primary text-sm font-bold disabled:opacity-60"
            >
              <Fingerprint size={17} />
              {fingerprintLoading ? t('auth.verifying') : t('auth.useFingerprint')}
            </button>
          )}
        </div>

        <div className="mt-6 pt-1 flex flex-col gap-3.5">
          <div className="relative flex items-center justify-center">
            <div className="w-full h-px bg-border-strong" />
            <span className="absolute bg-bg-card px-3 text-[11px] font-extrabold text-text-dim uppercase tracking-wider">{t('auth.quickCashierAccessDivider')}</span>
          </div>
          <button
            type="button"
            disabled
            title={t('auth.pinTerminalNotAvailable')}
            className="w-full py-2.5 px-4 rounded-xl border border-border bg-alerte-bg/50 flex items-center justify-center gap-2.5 opacity-60 cursor-not-allowed"
          >
            <IdCard size={16} className="text-or" />
            <span className="text-xs font-bold text-text">{t('auth.pinTerminalTitle')}</span>
            <ChevronDown size={16} className="text-text-dim -rotate-90" />
          </button>
        </div>

        <ShellSecurityFootnote />
      </div>
    </AuthDesktopShell>
  )
}
