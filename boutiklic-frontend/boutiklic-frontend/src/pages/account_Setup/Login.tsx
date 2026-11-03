import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { FingerprintIcon, PhoneIcon, EmailIcon } from '../../components/authIcons'
import CountryCodePicker from '../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface LoginProps {
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
  /** Absent = bouton masqué : pas de capteur biométrique disponible, ou appareil jamais connecté ici. */
  onFingerprintLogin?: () => void
  fingerprintLoading?: boolean
  loading?: boolean
  error?: string | null
}

export default function Login({
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
}: LoginProps) {
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex flex-col items-center gap-2.5 pt-5 pb-5 px-[22px]">
        <div
          className="w-[52px] h-[52px] rounded-[15px] bg-primary flex items-center justify-center"
          style={{ backgroundImage: 'repeating-linear-gradient(45deg,rgba(230,157,59,.35) 0 3px,transparent 3px 11px)' }}
        >
          <div className="w-5 h-5 rounded border-[3px] border-papier" style={{ borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
        </div>
        <div className="font-display font-extrabold text-[22px] tracking-tight">{t('auth.welcomeTitle')}</div>
        <div className="text-sm font-semibold text-text-muted">{t('auth.welcomeSubtitle')}</div>
      </div>

      <div className="flex-none px-[22px] pb-3.5">
        <div className="flex gap-2.5">
          <button
            onClick={() => setChannel('phone')}
            className={`flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl ${
              channel === 'phone' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <PhoneIcon color={channel === 'phone' ? '#0E2038' : '#676E7E'} />
            <div className={`text-[13px] ${channel === 'phone' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelPhone')}</div>
          </button>
          <button
            onClick={() => setChannel('email')}
            className={`flex-1 flex items-center justify-center gap-2 h-[42px] rounded-xl ${
              channel === 'email' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <EmailIcon color={channel === 'email' ? '#0E2038' : '#676E7E'} />
            <div className={`text-[13px] ${channel === 'email' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelEmail')}</div>
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-4 pt-1 overflow-y-auto no-scrollbar">
        {channel === 'phone' ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.phoneNumberLabel')}</div>
            <div className="h-[60px] rounded-2xl flex items-center px-[18px] gap-3 border border-border-strong bg-bg">
              <CountryCodePicker countryId={countryId} setCountryId={setCountryId} />
              <div className="w-px h-6 bg-border-strong" />
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                placeholder="620 12 34 56"
                inputMode="numeric"
                className="amount flex-1 text-xl font-extrabold tracking-wide outline-none bg-transparent"
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.emailAddressLabel')}</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mariama.diallo@gmail.com"
              className="h-[60px] rounded-2xl px-[18px] text-lg font-extrabold outline-none border border-border-strong bg-bg"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.passwordLabel')}</div>
          <div className="h-[60px] rounded-2xl border border-border-strong bg-bg flex items-center px-[18px] gap-3">
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
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <button onClick={onForgotPassword} className="self-end text-[13px] font-bold text-terracotta">{t('auth.forgotPasswordLink')}</button>
        </div>

        {onFingerprintLogin && (
          <button
            onClick={onFingerprintLogin}
            disabled={fingerprintLoading}
            className="flex items-center justify-center gap-2.5 py-3 rounded-2xl border border-border-strong text-primary text-sm font-bold disabled:opacity-60"
          >
            <FingerprintIcon />
            {fingerprintLoading ? t('auth.verifying') : t('auth.useFingerprint')}
          </button>
        )}
      </div>

      <div className="flex-none px-[22px] pb-5 flex flex-col gap-3.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={onLogin}
          disabled={
            loading ||
            password.trim().length === 0 ||
            (channel === 'phone' ? phone.trim().length < 8 : email.trim().length === 0)
          }
          className="h-[62px] rounded-[18px] bg-primary text-papier text-lg font-extrabold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? t('auth.loggingIn') : t('auth.loginButton')}
        </button>
        <div className="text-center text-sm font-semibold text-text-muted">
          {t('auth.noAccountYet')} <span onClick={onSwitchToSignup} className="text-terracotta font-extrabold cursor-pointer">{t('auth.createAccountLink')}</span>
        </div>
      </div>
    </div>
  )
}
