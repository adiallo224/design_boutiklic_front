import { useState } from 'react'
import { PHONE_SIGNUP_ENABLED } from '@boutiklic/shared'
import { Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { PhoneIcon, EmailIcon } from '../../components/authIcons'
import CountryCodePicker from '../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface CreateAccountProps {
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

export default function CreateAccount({
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
}: CreateAccountProps) {
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
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-3.5">
        <button onClick={onSwitchToLogin} className="w-10 h-10 rounded-xl border border-border-strong flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{channel === 'phone' ? t('auth.myPhoneNumberTitle') : t('auth.myEmailTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.stepOneOfThree')}</div>
        </div>
      </div>

      <div className="flex-none px-[22px] pb-[22px]">
        <div className="h-[5px] rounded-full bg-fond-planche flex gap-1">
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-fond-planche rounded-full" />
          <div className="flex-1 bg-fond-planche rounded-full" />
        </div>
      </div>

      {PHONE_SIGNUP_ENABLED && (
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
      )}

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-4 pt-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.fullNameLabel')}</div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Mariama Diallo"
            className="h-[58px] rounded-2xl border border-border-strong bg-bg px-[18px] text-lg font-bold outline-none focus:border-primary"
          />
        </div>

        {channel === 'phone' ? (
          <div className="flex flex-col gap-2">
            <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.phoneNumberLabel')}</div>
            <div className="h-[60px] rounded-2xl flex items-center px-[18px] gap-3 border-2 border-primary bg-bg-card">
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
              className="h-[58px] rounded-2xl px-[18px] text-lg font-extrabold outline-none border-2 border-primary bg-bg-card"
            />
          </div>
        )}

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
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.confirmPasswordLabel')}</div>
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

        <div className="flex gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E2038" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <div className="text-[13px] leading-relaxed text-[#33465E]">
            {t('auth.otpCodeIntro')} {channel === 'phone' ? t('auth.viaSms') : t('auth.viaEmailChannel')} {t('auth.toConfirm')}{' '}
            {channel === 'phone' ? t('auth.confirmThisNumber') : t('auth.confirmThisAddress')}
          </div>
        </div>
      </div>

      <div className="flex-none px-[22px] pb-5 flex flex-col gap-3.5">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <p className="text-[12.5px] text-text-muted text-center leading-relaxed">
          En continuant, vous acceptez nos{' '}
          <a href="/cgv" target="_blank" rel="noreferrer" className="underline font-bold">Conditions Générales de Vente</a>
          {' '}et notre{' '}
          <a href="/confidentialite" target="_blank" rel="noreferrer" className="underline font-bold">politique de protection des données</a>.
        </p>
        <button
          onClick={onReceiveCode}
          disabled={!canSubmit}
          className="h-[62px] rounded-[18px] bg-primary text-papier text-lg font-extrabold flex items-center justify-center active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? t('auth.sendingCode') : t('auth.receiveCodeButton')}
        </button>
        <div className="text-center text-sm font-semibold text-text-muted">
          {t('auth.alreadyHaveAccount')} <span onClick={onSwitchToLogin} className="text-terracotta font-bold cursor-pointer">{t('auth.loginButton')}</span>
        </div>
      </div>
    </div>
  )
}
