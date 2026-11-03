import { useTranslation } from 'react-i18next'
import { Smartphone, Mail, ArrowRight, ChevronLeft, MessageCircle } from 'lucide-react'
import AuthDesktopShell, { ShellSecurityFootnote } from './AuthDesktopShell'
import CountryCodePicker from '../../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface ForgotPasswordDesktopProps {
  channel: Channel
  setChannel: (c: Channel) => void
  countryId: string
  setCountryId: (id: string) => void
  phone: string
  setPhone: (v: string) => void
  email: string
  setEmail: (v: string) => void
  onSendCode: () => void
  onBack: () => void
  onSwitchToSignup: () => void
  loading?: boolean
  error?: string | null
}

/** W25 — refonte visuelle : même coquille (AuthDesktopShell) et même langage visuel que
 *  LoginDesktop/CreateAccountDesktop (étude study/web/connexion_web_page_redesign) — remplace
 *  l'ancien habillage AuthCenteredCard, resté en retard sur les deux autres écrans du parcours
 *  d'authentification. Même formulaire/validation qu'avant (canal, indicatif + numéro ou email,
 *  note de sécurité) — aucun changement de comportement, seul l'habillage change. */
export default function ForgotPasswordDesktop({
  channel,
  setChannel,
  countryId,
  setCountryId,
  phone,
  setPhone,
  email,
  setEmail,
  onSendCode,
  onBack,
  onSwitchToSignup,
  loading = false,
  error = null,
}: ForgotPasswordDesktopProps) {
  const { t } = useTranslation()
  const canSubmit = !loading && (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)

  return (
    <AuthDesktopShell active="login" onNavigateLogin={onBack} onNavigateSignup={onSwitchToSignup}>
      <div className="w-full max-w-[420px] flex flex-col">
        <div className="mb-7">
          <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1.5 text-sm font-bold text-text-muted hover:text-text">
            <ChevronLeft size={17} strokeWidth={2.4} />
            {t('auth.backToLogin')}
          </button>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-info-bg text-primary text-[11px] font-extrabold uppercase tracking-wide mb-3">
            <ArrowRight size={12} /> {t('auth.portalBadge')}
          </div>
          <h2 className="font-display text-xl min-[400px]:text-2xl font-extrabold tracking-tight text-text mb-1.5 break-words">{t('auth.forgotPasswordTitle')}</h2>
          <p className="text-sm font-semibold text-text-muted">{t('auth.forgotPasswordSubtitle')}</p>
        </div>

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

        <div className="flex flex-col gap-5">
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
                  onKeyDown={(e) => e.key === 'Enter' && canSubmit && onSendCode()}
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
                onKeyDown={(e) => e.key === 'Enter' && canSubmit && onSendCode()}
              />
            </div>
          )}

          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-info-bg">
            <MessageCircle size={17} className="text-primary flex-none mt-0.5" />
            <p className="text-[13px] font-semibold text-info-text leading-relaxed">
              {channel === 'phone' ? t('auth.smsCodeExplainer') : t('auth.emailCodeExplainer')}
            </p>
          </div>

          {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

          <button
            type="button"
            onClick={() => canSubmit && onSendCode()}
            disabled={!canSubmit}
            className="w-full min-h-14 py-2 rounded-xl bg-primary text-papier text-base font-extrabold flex items-center justify-center gap-2 hover:bg-primary-dark transition-all active:scale-[0.99] shadow-lg disabled:opacity-50"
          >
            {loading ? t('auth.sending') : t('auth.sendCode')}
            {!loading && <ArrowRight size={18} />}
          </button>
        </div>

        <ShellSecurityFootnote />
      </div>
    </AuthDesktopShell>
  )
}
