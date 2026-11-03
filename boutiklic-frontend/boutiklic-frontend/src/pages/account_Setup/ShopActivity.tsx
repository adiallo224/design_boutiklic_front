import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import TaxChoice from '../../components/TaxChoice'

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

interface ShopActivityProps {
  onBack: () => void
  category: string
  setCategory: (c: string) => void
  size: 'PETITE' | 'MOYENNE' | 'GRANDE'
  setSize: (s: 'PETITE' | 'MOYENNE' | 'GRANDE') => void
  /** Choix « J'applique la TVA » (Non par défaut) ; masqué quand non fourni. */
  applyTax?: boolean
  setApplyTax?: (value: boolean) => void
  onFinish: () => void
  loading?: boolean
  error?: string | null
}

export default function ShopActivity({ onBack, category, setCategory, size, setSize, applyTax, setApplyTax, onFinish, loading = false, error = null }: ShopActivityProps) {
  const { t } = useTranslation()
  return (
    <div className="h-dvh flex flex-col bg-bg safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card" />
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.yourBusinessTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.stepFourOfFour')}</div>
        </div>
      </div>
      <div className="flex-none px-[22px] pb-5">
        <div className="h-[5px] rounded-full bg-fond-planche flex gap-1">
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col gap-[18px] overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.whatDoYouSell')}</div>
          <div className="grid grid-cols-3 gap-2.5">
            {categories.map((c) => {
              const active = category === c.id
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={`rounded-2xl py-3.5 px-2.5 flex flex-col items-center gap-1.5 ${
                    active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
                  }`}
                >
                  <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl" style={{ background: c.bg }}>
                    {c.emoji}
                  </div>
                  <div className={`text-[13px] text-center leading-tight ${active ? 'font-extrabold text-primary' : 'font-semibold text-[#5C5147]'}`}>
                    {t(c.labelKey)}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2.5">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopSizeLabel')}</div>
          {sizes.map((s) => {
            const active = size === s.id
            return (
              <button
                key={s.id}
                onClick={() => setSize(s.id as typeof size)}
                className={`flex items-center gap-3.5 p-4 rounded-[17px] ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
              >
                <div className={`w-[22px] h-[22px] rounded-full flex-none flex items-center justify-center ${active ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
                  {active && <Check size={13} strokeWidth={3.6} className="text-papier" />}
                </div>
                <div className="flex-1 flex flex-col gap-0.5 text-left">
                  <div className={`text-base ${active ? 'font-extrabold text-primary' : 'font-bold'}`}>{t(s.labelKey)}</div>
                  <div className={`text-[13px] ${active ? 'text-[#33465E]' : 'text-text-dim'}`}>{t(s.descKey)}</div>
                </div>
                <div className="flex gap-1 items-end flex-none">
                  {[1, 2, 3].map((bar) => (
                    <div
                      key={bar}
                      className="w-1.5 rounded-sm"
                      style={{ height: 6 * bar, background: bar <= s.bars ? (active ? '#0E2038' : '#DDD2C3') : '#DDD2C3' }}
                    />
                  ))}
                </div>
              </button>
            )
          })}
        </div>

        {setApplyTax && <TaxChoice applyTax={applyTax ?? false} setApplyTax={setApplyTax} />}

        <div className="flex gap-3 p-4 rounded-2xl bg-alerte-bg border border-[#EED9AE]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9A7318" strokeWidth={2} strokeLinecap="round" className="flex-none mt-0.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8h.01M11 12h1v4h1" />
          </svg>
          <div className="text-sm leading-relaxed text-[#6B5410]">
            {t('auth.canChangeSizeLaterNotice')}
          </div>
        </div>
      </div>

      <div className="flex-none px-[22px] pt-4 pb-10 flex flex-col gap-3">
        {error && <div className="text-[13px] font-semibold text-danger text-center">{error}</div>}
        <button
          onClick={onFinish}
          disabled={loading}
          className="w-full h-[62px] rounded-[18px] bg-success text-papier text-lg font-extrabold disabled:opacity-50"
        >
          {loading ? t('auth.creatingInProgress') : t('auth.openMyShop')}
        </button>
      </div>
    </div>
  )
}
