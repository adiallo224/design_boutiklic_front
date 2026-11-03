import { ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import CountryCodePicker from '../../components/CountryCodePicker'

type Channel = 'phone' | 'email'

interface ForgotPasswordProps {
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
  loading?: boolean
  error?: string | null
}

const KeyIcon = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="#0E2038" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="7.5" cy="15.5" r="5.5" />
    <path d="m21 2-9.6 9.6M15.5 7.5 18 5l3 3-2.5 2.5" />
  </svg>
)

const ShieldIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E2038" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
    <path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z" />
  </svg>
)

const EmailBannerIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0E2038" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m2 7 10 6 10-6" />
  </svg>
)

export default function ForgotPassword({
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
  loading = false,
  error = null,
}: ForgotPasswordProps) {
  const { t } = useTranslation()
  const canSubmit = !loading && (channel === 'phone' ? phone.trim().length >= 8 : email.trim().length > 0)

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center gap-2.5 px-[22px] pt-2.5 pb-3.5">
        <button onClick={onBack} className="flex items-center gap-2.5">
          <ChevronLeft size={18} strokeWidth={2.4} />
          <span className="text-[15px] font-bold">{t('auth.backToLogin')}</span>
        </button>
      </div>
      <div className="flex-none px-[22px] pb-[22px]">
        <div className="h-1 rounded-full bg-fond-planche">
          <div className="h-1 rounded-full bg-primary" style={{ width: '60%' }} />
        </div>
      </div>

      <div className="flex-none px-[22px] pb-5 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-[13px] bg-info-bg flex items-center justify-center flex-none">
            <KeyIcon />
          </div>
          <div className="text-[22px] font-extrabold tracking-tight font-display">{t('auth.forgotPasswordTitle')}</div>
        </div>
        <div className="text-sm font-semibold text-text-muted">{t('auth.forgotPasswordSubtitle')}</div>
      </div>

      <div className="flex-1 min-h-0 mx-[22px] p-[18px] rounded-[22px] bg-bg-card border border-border-strong shadow-[0_12px_30px_-14px_rgba(17,20,24,.12)] flex flex-col gap-4 overflow-y-auto no-scrollbar">
        <div className="text-[15px] font-extrabold">{t('auth.howReceiveCode')}</div>

        <div className="flex gap-2.5">
          <button
            onClick={() => setChannel('phone')}
            className={`flex-1 flex items-center justify-center gap-2 h-[46px] rounded-xl ${
              channel === 'phone' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={channel === 'phone' ? '#0E2038' : '#676E7E'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.32 1.78.6 2.63a2 2 0 0 1-.45 2.11L8.09 9.63a16 16 0 0 0 6 6l1.17-1.17a2 2 0 0 1 2.11-.45c.85.28 1.73.48 2.63.6A2 2 0 0 1 22 16.92z" />
            </svg>
            <div className={`text-[14px] ${channel === 'phone' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelPhone')}</div>
          </button>
          <button
            onClick={() => setChannel('email')}
            className={`flex-1 flex items-center justify-center gap-2 h-[46px] rounded-xl ${
              channel === 'email' ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={channel === 'email' ? '#0E2038' : '#676E7E'} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 6 10-6" />
            </svg>
            <div className={`text-[14px] ${channel === 'email' ? 'font-extrabold text-primary' : 'font-bold text-text-muted'}`}>{t('auth.channelEmail')}</div>
          </button>
        </div>

        {channel === 'phone' ? (
          <>
            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.countryCodeLabel')}</div>
              <div className="flex items-center h-[54px] px-4 rounded-2xl border border-border-strong bg-bg w-fit">
                <CountryCodePicker countryId={countryId} setCountryId={setCountryId} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.phoneNumberLabel')}</div>
              <div className="h-[58px] rounded-2xl border border-border-strong bg-bg flex items-center px-[18px] gap-3">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                  placeholder="620 12 34 56"
                  inputMode="numeric"
                  className="amount flex-1 text-lg font-extrabold tracking-wide outline-none bg-transparent"
                />
              </div>
            </div>

            <div className="flex gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
              <ShieldIcon />
              <div className="text-[13px] leading-relaxed text-[#33465E]">
                {t('auth.smsCodeExplainer')}
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-2">
              <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.emailAddressLabel')}</div>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mariama.diallo@gmail.com"
                className="h-[58px] rounded-2xl px-[18px] text-lg font-bold outline-none border border-border-strong bg-bg"
              />
            </div>

            <div className="flex gap-2.5 p-3.5 rounded-2xl bg-info-bg border border-info-border">
              <EmailBannerIcon />
              <div className="text-[13px] leading-relaxed text-[#33465E]">
                {t('auth.emailCodeExplainer')}
              </div>
            </div>
          </>
        )}

        <div className="flex-1" />

        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={() => canSubmit && onSendCode()}
          disabled={!canSubmit}
          className="h-[58px] rounded-2xl bg-primary text-papier text-[17px] font-extrabold flex items-center justify-center gap-2.5 active:scale-95 transition-transform disabled:opacity-50"
        >
          {loading ? t('auth.sending') : <>{t('auth.sendCode')} <span>→</span></>}
        </button>
      </div>

      <div className="flex-none h-5" />
    </div>
  )
}
