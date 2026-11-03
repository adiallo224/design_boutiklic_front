import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronDown, ChevronLeft, Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LANGUAGES, setLanguage } from '../../lib/language'

interface Slide {
  titleKey: string
  descriptionKey: string
  swatches: string[]
  stripes: string
  ticketLabelKey: string
  ticketValue: string
}

const slides: Slide[] = [
  {
    titleKey: 'auth.slide1Title',
    descriptionKey: 'auth.slide1Description',
    swatches: ['#0E7A52', '#E69D3B', '#D84E2A'],
    stripes: 'repeating-linear-gradient(90deg,#0E2038 0 14px,#E69D3B 14px 28px,#D84E2A 28px 42px)',
    ticketLabelKey: 'auth.slide1TicketLabel',
    ticketValue: '85 000',
  },
  {
    titleKey: 'auth.slide2Title',
    descriptionKey: 'auth.slide2Description',
    swatches: ['#E69D3B', '#0E7A52', '#0E2038'],
    stripes: 'repeating-linear-gradient(90deg,#E69D3B 0 14px,#0E2038 14px 28px,#0E7A52 28px 42px)',
    ticketLabelKey: 'auth.slide2TicketLabel',
    ticketValue: '45 art.',
  },
  {
    titleKey: 'auth.slide3Title',
    descriptionKey: 'auth.slide3Description',
    swatches: ['#D84E2A', '#0E2038', '#E69D3B'],
    stripes: 'repeating-linear-gradient(90deg,#D84E2A 0 14px,#0E7A52 14px 28px,#0E2038 28px 42px)',
    ticketLabelKey: 'auth.slide3TicketLabel',
    ticketValue: '25 000',
  },
]

interface OnboardingProps {
  /** Par défaut : navigue vers /login (route /onboarding, premier lancement de l'app). */
  onFinish?: () => void
  /** Si fourni, affiche un bouton retour (ex. étape 1 d'un assistant de création de boutique). */
  onBack?: () => void
}

export default function Onboarding({ onFinish, onBack }: OnboardingProps) {
  const { t, i18n } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0])
  const [showLangPicker, setShowLangPicker] = useState(false)
  const navigate = useNavigate()

  const finish = () => {
    localStorage.setItem('boutiklic_onboarding', 'true')
    setLanguage(selectedLang.code)
    if (onFinish) onFinish()
    else navigate('/login')
  }

  const next = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1)
    else finish()
  }

  const slide = slides[currentSlide]

  return (
    <div className="h-dvh flex flex-col bg-bg-card safe-top">
      <div className="flex-none flex items-center justify-between px-6 pt-2 pb-1">
        {onBack ? (
          <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
            <ChevronLeft size={20} />
          </button>
        ) : (
          <div />
        )}
        <button onClick={finish} className="text-[15px] font-bold text-text-muted">
          {t('auth.skip')}
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center gap-9 px-8 overflow-y-auto no-scrollbar">
        <div
          className="h-[260px] rounded-[26px] bg-[#F4EDE0] border border-border relative overflow-hidden flex items-center justify-center"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,rgba(216,78,42,.09) 0 2px,transparent 2px 18px)' }}
        >
          <div className="flex flex-col items-center gap-3.5">
            <div className="w-[150px] h-24 rounded-2xl bg-bg-card border border-border flex flex-col justify-center px-4 gap-2 shadow-[0_10px_24px_rgba(17,20,24,.08)]">
              <div className="text-[11px] font-extrabold text-text-dim tracking-widest">{t(slide.ticketLabelKey)}</div>
              <div className="amount text-2xl font-extrabold text-primary">{slide.ticketValue}</div>
            </div>
            <div className="flex gap-2.5">
              {slide.swatches.map((c, i) => (
                <div key={i} className="w-11 h-11 rounded-xl" style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="absolute left-0 right-0 bottom-0 h-3.5" style={{ background: slide.stripes }} />
        </div>

        <div className="flex flex-col gap-3.5">
          <h1 className="font-display font-extrabold text-[32px] leading-[1.15] tracking-tight whitespace-pre-line">{t(slide.titleKey)}</h1>
          <p className="text-[17px] leading-relaxed text-text-muted">{t(slide.descriptionKey)}</p>
        </div>

        <div className="flex gap-2">
          {slides.map((_, idx) => (
            <div
              key={idx}
              className={`h-2 rounded-full transition-all ${idx === currentSlide ? 'w-[26px] bg-primary' : 'w-2 bg-[#DDD2C3]'}`}
            />
          ))}
        </div>
      </div>

      <div className="flex-none px-8 pt-6 pb-10 flex flex-col gap-4 relative">
        {showLangPicker && (
          <div className="absolute bottom-full left-8 right-8 mb-2 max-h-[260px] overflow-y-auto no-scrollbar bg-bg-card border border-border rounded-2xl shadow-lg">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                onClick={() => { setSelectedLang(lang); setShowLangPicker(false); i18n.changeLanguage(lang.code) }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-bg"
              >
                <span className="font-semibold">{lang.name}</span>
                {selectedLang.code === lang.code && <Check size={16} className="text-primary" />}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="h-[52px] px-[18px] rounded-2xl border border-border bg-bg flex items-center justify-between"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-[13px] font-extrabold tracking-widest text-text-dim">{t('auth.languageLabel')}</span>
            <span className="text-base font-bold">{selectedLang.name}</span>
          </div>
          <ChevronDown size={18} className="text-text-muted" />
        </button>
        <button
          onClick={next}
          className="h-[60px] rounded-[18px] bg-primary text-papier text-lg font-bold flex items-center justify-center active:scale-95 transition-transform"
        >
          {t('auth.continue')}
        </button>
      </div>
    </div>
  )
}
