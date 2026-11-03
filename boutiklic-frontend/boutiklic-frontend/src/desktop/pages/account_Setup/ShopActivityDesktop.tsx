import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import AuthStepLayout from './AuthStepLayout'
import TaxChoice from '../../../components/TaxChoice'
import type { StepDef } from './shopSetupSteps'

const categories = [
  { id: 'ALIMENTATION', labelKey: 'auth.categoryFood', emoji: '🍚', bg: '#F4E7D2' },
  { id: 'QUINCAILLERIE', labelKey: 'auth.categoryHardware', emoji: '🔧', bg: '#E4EAF2' },
  { id: 'COSMETIQUE', labelKey: 'auth.categoryCosmetics', emoji: '💄', bg: '#F4E3DE' },
  { id: 'TELEPHONIE', labelKey: 'auth.categoryPhones', emoji: '📱', bg: '#E7E2EE' },
  { id: 'HABILLEMENT', labelKey: 'auth.categoryClothing', emoji: '👕', bg: '#E6F1EC' },
  { id: 'AUTRE', labelKey: 'auth.categoryOther', emoji: '➕', bg: '#EDE6D0' },
]

const sizes = [
  { id: 'PETITE', labelKey: 'settings.shopSize.small', descKey: 'auth.sizeSmallDesc', bars: 1 },
  { id: 'MOYENNE', labelKey: 'settings.shopSize.medium', descKey: 'auth.sizeMediumDesc', bars: 2 },
  { id: 'GRANDE', labelKey: 'settings.shopSize.large', descKey: 'auth.sizeLargeDesc', bars: 3 },
]

interface ShopActivityDesktopProps {
  onBack: () => void
  category: string
  setCategory: (c: string) => void
  size: 'PETITE' | 'MOYENNE' | 'GRANDE'
  setSize: (s: 'PETITE' | 'MOYENNE' | 'GRANDE') => void
  /** Choix « J'applique la TVA » (Non par défaut) ; masqué quand non fourni. */
  applyTax?: boolean
  setApplyTax?: (value: boolean) => void
  onFinish: () => void
  steps: StepDef[]
  completedStepIds: string[]
  loading?: boolean
  error?: string | null
}

export default function ShopActivityDesktop({
  onBack,
  category,
  setCategory,
  size,
  setSize,
  applyTax,
  setApplyTax,
  onFinish,
  steps,
  completedStepIds,
  loading = false,
  error = null,
}: ShopActivityDesktopProps) {
  const { t } = useTranslation()
  return (
    <AuthStepLayout
      steps={steps}
      currentStepId="activite"
      completedStepIds={completedStepIds}
      title={t('auth.yourBusinessTitle')}
      onBack={onBack}
      backLabel={t('auth.back')}
    >
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.whatDoYouSell')}</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {categories.map((c) => {
            const active = category === c.id
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                className={`rounded-xl py-3.5 px-2.5 flex flex-col items-center gap-1.5 ${
                  active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
                }`}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg" style={{ background: c.bg }}>
                  {c.emoji}
                </div>
                <div className={`text-[12px] text-center leading-tight ${active ? 'font-extrabold text-primary' : 'font-semibold text-[#5C5147]'}`}>
                  {t(c.labelKey)}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopSizeLabel')}</span>
        {sizes.map((s) => {
          const active = size === s.id
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSize(s.id as typeof size)}
              className={`flex items-center gap-3.5 p-3.5 rounded-xl ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
            >
              <div className={`w-5 h-5 rounded-full flex-none flex items-center justify-center ${active ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
                {active && <Check size={12} strokeWidth={3.6} className="text-papier" />}
              </div>
              <div className="flex-1 flex flex-col gap-0.5 text-left">
                <div className={`text-sm ${active ? 'font-extrabold text-primary' : 'font-bold'}`}>{t(s.labelKey)}</div>
                <div className={`text-[12px] ${active ? 'text-[#33465E]' : 'text-text-dim'}`}>{t(s.descKey)}</div>
              </div>
            </button>
          )
        })}
      </div>

      {setApplyTax && <TaxChoice applyTax={applyTax ?? false} setApplyTax={setApplyTax} />}

      <div className="flex gap-3 p-3.5 rounded-xl bg-alerte-bg border border-[#EED9AE] min-w-0 break-words">
        <div className="text-sm leading-relaxed text-[#6B5410]">{t('auth.canChangeSizeLaterNotice')}</div>
      </div>

      {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}

      <button
        type="button"
        onClick={onFinish}
        disabled={loading}
        className="min-h-12 py-2 rounded-xl bg-success text-papier text-base font-extrabold disabled:opacity-50"
      >
        {loading ? t('auth.creatingInProgress') : t('auth.openMyShop')}
      </button>
    </AuthStepLayout>
  )
}
