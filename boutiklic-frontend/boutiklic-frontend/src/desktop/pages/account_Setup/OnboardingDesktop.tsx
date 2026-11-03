import { useState } from 'react'
import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '../../../lib/language'
import AuthCenteredCard from './AuthCenteredCard'

interface OnboardingDesktopProps {
  onFinish?: () => void
  onBack?: () => void
}

/** Étape "Langue" de W10 — le mobile mêle ce choix à un carrousel marketing (Onboarding.tsx) ;
 *  sur bureau on garde uniquement le sélecteur de langue (cf. plan desktop, "drop the carousel").
 *  Volontairement hors rail : un simple interstitiel avant les 3 vraies étapes du rail. */
export default function OnboardingDesktop({ onFinish, onBack }: OnboardingDesktopProps) {
  const { t, i18n } = useTranslation()
  const [selectedLang, setSelectedLang] = useState(() => LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0])

  const finish = () => {
    localStorage.setItem('boutiklic_onboarding', 'true')
    setLanguage(selectedLang.code)
    i18n.changeLanguage(selectedLang.code)
    if (onFinish) onFinish()
  }

  return (
    <AuthCenteredCard title={t('auth.languageLabel')} onBack={onBack} backLabel={t('auth.back')} width={420}>
      <div className="flex flex-col gap-2">
        {LANGUAGES.map((lang) => {
          const active = selectedLang.code === lang.code
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setSelectedLang(lang)}
              className={`flex items-center justify-between px-4 h-12 rounded-xl ${
                active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg'
              }`}
            >
              <span className={`text-base ${active ? 'font-extrabold text-primary' : 'font-semibold text-text'}`}>{lang.name}</span>
              {active && <Check size={16} className="text-primary" />}
            </button>
          )
        })}
      </div>

      <button
        type="button"
        onClick={finish}
        className="h-12 rounded-xl bg-primary text-papier text-base font-extrabold flex items-center justify-center"
      >
        {t('auth.continue')}
      </button>
    </AuthCenteredCard>
  )
}
