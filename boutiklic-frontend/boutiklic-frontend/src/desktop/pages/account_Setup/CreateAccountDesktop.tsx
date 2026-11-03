import { useState } from 'react'
import { PHONE_SIGNUP_ENABLED } from '@boutiklic/shared'
import { Smartphone, Mail, Eye, EyeOff, ArrowRight, Check, MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthDesktopShell, { ShellSecurityFootnote } from './AuthDesktopShell'
import { SIGNUP_STEPS } from './shopSetupSteps'
import CountryCodePicker from '../../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface CreateAccountDesktopProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  name: string
  setName: (v: string) => void
  password: string
  setPassword: (v: string) => void
  onReceiveCode: () => void
  onSwitchToLogin: () => void
  loading?: boolean
  error?: string | null
}

/** W10, étape "Compte" — refonte visuelle (étude study/web/connexion_web_page_redesign),
 *  même coquille que LoginDesktop (AuthDesktopShell : bandeau de navigation + panneau de marque
 *  indigo + pied de page), pour rester cohérent avec l'écran de connexion. Le rail vertical
 *  d'étapes de l'ancien AuthStepLayout (partagé avec ShopCountryDesktop/ShopIdentityDesktop/
 *  ShopActivityDesktop/CreateShop.tsx — hors périmètre de cette refonte) est remplacé ici par un
 *  indicateur horizontal compact au-dessus du formulaire, sur les mêmes 4 étapes
 *  (SIGNUP_STEPS) : les écrans suivants du même parcours restent dans leur habillage actuel tant
 *  qu'ils n'ont pas été redemandés individuellement, plutôt que de les changer sans qu'on l'ait
 *  demandé.
 *
 *  Même formulaire/validation que la version précédente (et que CreateAccount.tsx mobile) — aucun
 *  changement de comportement, seul l'habillage change. */
export default function CreateAccountDesktop({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  name,
  setName,
  password,
  setPassword,
  onReceiveCode,
  onSwitchToLogin,
  loading = false,
  error = null,
}: CreateAccountDesktopProps) {
  const { t } = useTranslation()
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit =
    !loading &&
    name.trim().length > 0 &&
    password.length >= 8 &&
    confirmPassword.length > 0 &&
    !passwordsMismatch &&
    (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)

  return (
    <AuthDesktopShell active="signup" onNavigateLogin={onSwitchToLogin} onNavigateSignup={() => undefined}>
      <div className="w-full max-w-[460px] flex flex-col">
        <div className="flex items-center gap-1.5 mb-6">
          {SIGNUP_STEPS.map((step, i) => {
            const isCurrent = step.id === 'compte'
            return (
              <div key={step.id} className="flex items-center gap-1.5 flex-1">
                <div className="flex items-center gap-1.5 flex-1">
                  <span className={`flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-extrabold flex-none ${isCurrent ? 'bg-primary text-papier' : 'bg-bg-elevated text-text-dim'}`}>
                    {i + 1}
                  </span>
                  <span className={`text-[11px] font-bold uppercase tracking-wide truncate hidden sm:inline ${isCurrent ? 'text-text' : 'text-text-dim'}`}>{t(step.labelKey)}</span>
                </div>
                {i < SIGNUP_STEPS.length - 1 && <div className="flex-1 h-px bg-border-strong" />}
              </div>
            )
          })}
        </div>

        <div className="mb-7">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-info-bg text-primary text-[11px] font-extrabold uppercase tracking-wide mb-3">
            <ArrowRight size={12} /> {t('auth.portalBadge')}
          </div>
          <h2 className="font-display text-xl min-[400px]:text-2xl font-extrabold tracking-tight text-text mb-1.5 break-words">{channel === 'phone' ? t('auth.myPhoneNumberTitle') : t('auth.myEmailTitle')}</h2>
          <p className="text-sm font-semibold text-text-muted">
            {t('auth.alreadyHaveAccount')}{' '}
            <button type="button" onClick={onSwitchToLogin} className="text-terracotta font-extrabold inline-flex items-center gap-0.5">
              {t('auth.loginButton')} <ArrowRight size={13} />
            </button>
          </p>
        </div>

        {PHONE_SIGNUP_ENABLED && (
        <div className="p-1 rounded-xl bg-bg-elevated mb-5 flex flex-wrap items-center gap-1">
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
        )}

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-text">{t('auth.fullNameLabel')}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Mariama Diallo"
              className="h-12 rounded-xl px-4 text-base font-extrabold outline-none bg-bg-card shadow-sm focus:ring-2 focus:ring-primary focus:ring-offset-1"
            />
          </div>

          {channel === 'phone' ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-extrabold text-text">{t('auth.phoneNumberLabel')}</span>
                <span className="amount text-xs font-semibold text-text-dim">{t('auth.operatorPrefixHint')}</span>
              </div>
              <div className="flex rounded-xl bg-bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
                <div className="flex items-center px-3.5 rounded-l-xl bg-bg-elevated flex-none">
                  <CountryCodePicker countryId={countryId} setCountryId={setCountryId} />
                </div>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="620 12 34 56"
                  inputMode="numeric"
                  className="amount flex-1 min-w-0 bg-transparent px-4 py-3 text-base font-extrabold tracking-wide outline-none"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-extrabold text-text">{t('auth.emailAddressLabel')}</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mariama.diallo@gmail.com"
                className="h-12 rounded-xl px-4 text-base font-extrabold outline-none bg-bg-card shadow-sm focus:ring-2 focus:ring-primary focus:ring-offset-1"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-text">{t('auth.passwordLabel')}</span>
            <div className="flex items-center rounded-xl bg-bg-card shadow-sm focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-1">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="flex-1 min-w-0 bg-transparent px-4 py-3 text-base font-extrabold tracking-widest outline-none"
              />
              <button type="button" onClick={() => setShowPassword((s) => !s)} disabled={password.length === 0} className="p-3 text-text-dim hover:text-text disabled:opacity-40">
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {password.length > 0 && password.length < 8 && <span className="text-[13px] font-semibold text-danger">{t('auth.passwordMinLength')}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-extrabold text-text">{t('auth.confirmPasswordLabel')}</span>
            <div className={`flex items-center rounded-xl bg-bg-card shadow-sm focus-within:ring-2 focus-within:ring-offset-1 ${passwordsMismatch ? 'ring-2 ring-danger' : 'focus-within:ring-primary'}`}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••••••"
                className="flex-1 min-w-0 bg-transparent px-4 py-3 text-base font-extrabold tracking-widest outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((s) => !s)}
                disabled={confirmPassword.length === 0}
                className="p-3 text-text-dim hover:text-text disabled:opacity-40"
              >
                {showConfirmPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
            {passwordsMismatch && <span className="text-[13px] font-semibold text-danger">{t('auth.passwordsMismatch')}</span>}
          </div>

          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info-bg">
            <MessageCircle size={17} className="text-primary flex-none mt-0.5" />
            <p className="text-[13px] font-semibold text-info-text leading-relaxed">
              {t('auth.otpCodeIntro')} {channel === 'phone' ? t('auth.viaSms') : t('auth.viaEmailChannel')} {t('auth.toConfirm')}{' '}
              {channel === 'phone' ? t('auth.confirmThisNumber') : t('auth.confirmThisAddress')}
            </p>
          </div>

          {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

          <p className="text-xs sm:text-[12.5px] text-text-dim text-center leading-relaxed break-words">
            En continuant, vous acceptez nos{' '}
            <a href="/cgv" target="_blank" rel="noreferrer" className="underline font-bold">Conditions Générales de Vente</a>
            {' '}et notre{' '}
            <a href="/confidentialite" target="_blank" rel="noreferrer" className="underline font-bold">politique de protection des données</a>.
          </p>

          <button
            type="button"
            onClick={onReceiveCode}
            disabled={!canSubmit}
            className="w-full min-h-14 py-2 rounded-xl bg-primary text-papier text-base font-extrabold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all active:scale-[0.99] shadow-lg disabled:opacity-50"
          >
            {loading ? t('auth.sendingCode') : t('auth.receiveCodeButton')}
            {!loading && <Check size={18} />}
          </button>
        </div>

        <ShellSecurityFootnote />
      </div>
    </AuthDesktopShell>
  )
}
