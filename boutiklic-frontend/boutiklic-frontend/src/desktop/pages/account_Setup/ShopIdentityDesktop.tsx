import { useRef, useState } from 'react'
import { Camera, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fileApi } from '../../../lib/fileApi'
import AuthStepLayout from './AuthStepLayout'
import type { StepDef } from './shopSetupSteps'

interface ShopIdentityDesktopProps {
  shopName: string
  setShopName: (v: string) => void
  quartier: string
  setQuartier: (v: string) => void
  logoUrl: string | null
  setLogoUrl: (v: string | null) => void
  onContinue: () => void
  onBack: () => void
  steps: StepDef[]
  completedStepIds: string[]
}

/** Étape "Boutique" — le bloc localisation carte/GPS du mobile (coordonnées factices, bouton
 *  "Localiser" non fonctionnel) est une simple décoration sans logique réelle : on ne la reprend
 *  pas sur bureau, seuls le nom et le quartier (champs réellement envoyés à l'API) restent. */
export default function ShopIdentityDesktop({
  shopName,
  setShopName,
  quartier,
  setQuartier,
  logoUrl,
  setLogoUrl,
  onContinue,
  onBack,
  steps,
  completedStepIds,
}: ShopIdentityDesktopProps) {
  const { t } = useTranslation()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    try {
      const { url } = await fileApi.upload(file)
      setLogoUrl(url)
    } finally {
      setUploadingLogo(false)
      e.target.value = ''
    }
  }

  return (
    <AuthStepLayout
      steps={steps}
      currentStepId="boutique"
      completedStepIds={completedStepIds}
      title={t('auth.myShopTitle')}
      onBack={onBack}
      backLabel={t('auth.back')}
    >
      <div className="flex flex-wrap items-center gap-4">
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadingLogo}
          className="w-20 h-20 rounded-full bg-[#F4EDE0] border-2 border-dashed border-[#DDD2C3] flex items-center justify-center relative overflow-hidden disabled:opacity-70 shrink-0"
        >
          {logoUrl ? (
            <img src={logoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <Camera size={26} strokeWidth={1.7} className="text-text-dim" />
          )}
          <div className="absolute right-0 bottom-0 w-7 h-7 rounded-full bg-primary border-2 border-bg flex items-center justify-center">
            <Plus size={14} strokeWidth={2.6} className="text-papier" />
          </div>
        </button>
        <span className="text-sm font-bold text-text-muted">{uploadingLogo ? t('settings.uploading') : t('auth.addShopLogo')}</span>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopNameLabel')}</span>
        <input
          value={shopName}
          onChange={(e) => setShopName(e.target.value)}
          className="h-12 rounded-xl border-2 border-primary bg-bg-card px-4 text-base font-bold outline-none"
        />
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.neighborhoodLabel')}</span>
        <input
          value={quartier}
          onChange={(e) => setQuartier(e.target.value)}
          className="h-12 rounded-xl border border-border-strong bg-bg-card px-4 text-[15px] font-bold outline-none focus:border-primary"
        />
      </div>

      <button type="button" onClick={onContinue} disabled={!shopName} className="min-h-12 py-2 rounded-xl bg-primary text-papier text-base font-extrabold disabled:opacity-50">
        {t('auth.continue')}
      </button>
    </AuthStepLayout>
  )
}
