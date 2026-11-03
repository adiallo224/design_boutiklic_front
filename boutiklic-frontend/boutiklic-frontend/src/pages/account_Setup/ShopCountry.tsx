import { useState } from 'react'
import { Check, ChevronDown, ChevronLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES as countries, type Country } from '@boutiklic/shared'
import FlagIcon from '../../components/FlagIcon'

interface ShopCountryProps {
  countryId: string
  setCountryId: (id: string) => void
  onContinue: () => void
  onBack?: () => void
}

/** Étape 2/4 de la création de boutique — pays & devise (cf. ShopProfile.tsx "DEVISE", "Fixée à la
 *  création" : ce choix n'était jusqu'ici jamais réellement proposé, toujours codé en dur à GNF).
 *  Étape 1 = Onboarding (langue). */
export default function ShopCountry({ countryId, setCountryId, onContinue, onBack }: ShopCountryProps) {
  const { t } = useTranslation()
  const [showPicker, setShowPicker] = useState(false)
  const selected = countries.find((c) => c.id === countryId) ?? countries[0]
  const CURRENCY_LABELS: Record<Country['currency'], string> = {
    GNF: t('common.currency.gnf'),
    FCFA: t('common.currency.fcfa'),
    SLE: t('common.currency.sle'),
    LRD: t('common.currency.lrd'),
    GHS: t('common.currency.ghs'),
    NGN: t('common.currency.ngn'),
    GMD: t('common.currency.gmd'),
    CVE: t('common.currency.cve'),
    DZD: t('common.currency.dzd'),
    AOA: t('common.currency.aoa'),
    BWP: t('common.currency.bwp'),
    BIF: t('common.currency.bif'),
    KMF: t('common.currency.kmf'),
    CDF: t('common.currency.cdf'),
    DJF: t('common.currency.djf'),
    EGP: t('common.currency.egp'),
    ERN: t('common.currency.ern'),
    SZL: t('common.currency.szl'),
    ETB: t('common.currency.etb'),
    KES: t('common.currency.kes'),
    LSL: t('common.currency.lsl'),
    LYD: t('common.currency.lyd'),
    MGA: t('common.currency.mga'),
    MWK: t('common.currency.mwk'),
    MUR: t('common.currency.mur'),
    MRU: t('common.currency.mru'),
    MAD: t('common.currency.mad'),
    MZN: t('common.currency.mzn'),
    NAD: t('common.currency.nad'),
    UGX: t('common.currency.ugx'),
    RWF: t('common.currency.rwf'),
    STN: t('common.currency.stn'),
    SCR: t('common.currency.scr'),
    SOS: t('common.currency.sos'),
    SDG: t('common.currency.sdg'),
    SSP: t('common.currency.ssp'),
    ZAR: t('common.currency.zar'),
    TZS: t('common.currency.tzs'),
    TND: t('common.currency.tnd'),
    ZMW: t('common.currency.zmw'),
    ZWG: t('common.currency.zwg'),
  }

  return (
    <div className="h-dvh flex flex-col bg-bg safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-4">
        {onBack ? (
          <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <div className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card" />
        )}
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.countryAndCurrencyTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.stepTwoOfFour')}</div>
        </div>
      </div>
      <div className="flex-none px-[22px] pb-5">
        <div className="h-[5px] rounded-full bg-fond-planche flex gap-1">
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-fond-planche rounded-full" />
          <div className="flex-1 bg-fond-planche rounded-full" />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-[18px] overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2 relative">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.countryLabel')}</div>
          <button
            onClick={() => setShowPicker((s) => !s)}
            className="h-[60px] rounded-2xl border-2 border-primary bg-bg-card flex items-center justify-between px-[18px]"
          >
            <div className="flex items-center gap-3">
              <FlagIcon countryId={selected.id} className="text-2xl" />
              <span className="text-[17px] font-bold">{selected.name}</span>
            </div>
            <ChevronDown size={18} className={`text-text-muted transition-transform ${showPicker ? 'rotate-180' : ''}`} />
          </button>

          {showPicker && (
            <div className="absolute top-full left-0 right-0 mt-2 max-h-[280px] overflow-y-auto no-scrollbar bg-bg-card border border-border rounded-2xl shadow-lg z-10">
              {countries.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setCountryId(c.id); setShowPicker(false) }}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-bg"
                >
                  <div className="flex items-center gap-3">
                    <FlagIcon countryId={c.id} className="text-xl" />
                    <span className="font-semibold">{c.name}</span>
                  </div>
                  {c.id === selected.id && <Check size={16} className="text-primary" />}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.currencyLabel')}</div>
          <div className="h-[60px] rounded-2xl border border-border-strong bg-bg-elevated flex items-center px-[18px] gap-3">
            <span className="text-[17px] font-bold text-text-muted">{CURRENCY_LABELS[selected.currency]}</span>
            <span className="ml-auto text-[17px] font-extrabold text-primary">{selected.currency}</span>
          </div>
        </div>

        <div className="flex gap-3 p-4 rounded-2xl bg-alerte-bg border border-[#EED9AE]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9A7318" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <div className="text-sm leading-relaxed text-[#6B5410]">
            {t('auth.currencyFixedNotice')}
          </div>
        </div>
      </div>

      <div className="flex-none px-[22px] pt-4 pb-10">
        <button
          onClick={onContinue}
          className="w-full h-[62px] rounded-[18px] bg-primary text-papier text-lg font-extrabold"
        >
          {t('auth.continue')}
        </button>
      </div>
    </div>
  )
}
