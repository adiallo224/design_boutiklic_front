import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface TaxChoiceProps {
  applyTax: boolean
  setApplyTax: (value: boolean) => void
}

/**
 * Création de boutique : « Appliquez-vous la TVA à vos ventes ? ». Non par défaut — la plupart des petites boutiques de quartier ne sont
 * pas assujetties : leurs prix restent ceux affichés, sans bloc de TVA sur le ticket. Oui déclenche l'amorçage du taux officiel du pays
 * (s'il y en a un) ; les taux se règlent ensuite dans Réglages → TVA. À ne pas confondre avec un taux à 0 %, qui est une TVA appliquée à 0.
 */
export default function TaxChoice({ applyTax, setApplyTax }: TaxChoiceProps) {
  const { t } = useTranslation()
  const options = [
    { value: false, label: t('auth.taxChoiceNo'), desc: t('auth.taxChoiceNoDesc') },
    { value: true, label: t('auth.taxChoiceYes'), desc: t('auth.taxChoiceYesDesc') },
  ]
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={t('auth.taxChoiceQuestion') ?? undefined}>
      <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.taxChoiceLabel')}</div>
      <div className="text-sm font-bold">{t('auth.taxChoiceQuestion')}</div>
      {options.map((o) => {
        const active = applyTax === o.value
        return (
          <button
            key={String(o.value)}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setApplyTax(o.value)}
            className={`flex items-center gap-3.5 p-4 rounded-[17px] text-left ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
          >
            <div className={`w-[22px] h-[22px] rounded-full flex-none flex items-center justify-center ${active ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
              {active && <Check size={13} strokeWidth={3.6} className="text-papier" />}
            </div>
            <div className="flex-1 flex flex-col gap-0.5">
              <div className={`text-base ${active ? 'font-extrabold text-primary' : 'font-bold'}`}>{o.label}</div>
              <div className={`text-[13px] ${active ? 'text-[#33465E]' : 'text-text-dim'}`}>{o.desc}</div>
            </div>
          </button>
        )
      })}
      <div className="text-xs text-text-muted">{t('auth.taxChoiceLater')}</div>
    </div>
  )
}
