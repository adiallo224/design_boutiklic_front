import { useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { COUNTRIES as countries, type Country } from '@boutiklic/shared'
import FlagIcon from '../../../components/FlagIcon'
import AuthStepLayout from './AuthStepLayout'
import type { StepDef } from './shopSetupSteps'

interface ShopCountryDesktopProps {
  countryId: string
  setCountryId: (id: string) => void
  onContinue: () => void
  onBack?: () => void
  steps: StepDef[]
  completedStepIds: string[]
}

export default function ShopCountryDesktop({ countryId, setCountryId, onContinue, onBack, steps, completedStepIds }: ShopCountryDesktopProps) {
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
    <AuthStepLayout
      steps={steps}
      currentStepId="pays"
      completedStepIds={completedStepIds}
      title={t('auth.countryAndCurrencyTitle')}
      onBack={onBack}
      backLabel={t('auth.back')}
    >
      <div className="flex flex-col gap-2 relative">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.countryLabel')}</span>
        <button
          type="button"
          onClick={() => setShowPicker((s) => !s)}
          className="min-h-12 py-1 rounded-xl border-2 border-primary bg-bg-card flex items-center justify-between gap-2 px-4"
        >
          <div className="flex items-center gap-3">
            <FlagIcon countryId={selected.id} className="text-2xl" />
            <span className="text-[15px] font-bold">{selected.name}</span>
          </div>
          <ChevronDown size={17} className={`text-text-muted transition-transform ${showPicker ? 'rotate-180' : ''}`} />
        </button>

        {showPicker && (
          <div className="absolute top-full left-0 right-0 mt-2 max-h-[280px] overflow-y-auto bg-bg-card border border-border rounded-xl shadow-lg z-10">
            {countries.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setCountryId(c.id)
                  setShowPicker(false)
                }}
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
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.currencyLabel')}</span>
        <div className="min-h-12 py-1 rounded-xl border border-border-strong bg-bg-elevated flex items-center px-4 gap-3">
          <span className="text-[15px] font-bold text-text-muted">{CURRENCY_LABELS[selected.currency]}</span>
          <span className="ml-auto text-[15px] font-extrabold text-primary">{selected.currency}</span>
        </div>
      </div>

      <div className="flex gap-3 p-3.5 rounded-xl bg-alerte-bg border border-[#EED9AE] min-w-0 break-words">
        <div className="text-sm leading-relaxed text-[#6B5410]">{t('auth.currencyFixedNotice')}</div>
      </div>

      <button type="button" onClick={onContinue} className="min-h-12 py-2 rounded-xl bg-primary text-papier text-base font-extrabold">
        {t('auth.continue')}
      </button>
    </AuthStepLayout>
  )
}
