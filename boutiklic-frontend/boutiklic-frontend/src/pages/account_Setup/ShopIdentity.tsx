import { useRef, useState } from 'react'
import { Camera, ChevronLeft, Plus, MapPin } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fileApi } from '../../lib/fileApi'

interface ShopIdentityProps {
  shopName: string
  setShopName: (v: string) => void
  quartier: string
  setQuartier: (v: string) => void
  logoUrl: string | null
  setLogoUrl: (v: string | null) => void
  onContinue: () => void
  onBack: () => void
}

export default function ShopIdentity({
  shopName,
  setShopName,
  quartier,
  setQuartier,
  logoUrl,
  setLogoUrl,
  onContinue,
  onBack,
}: ShopIdentityProps) {
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
    <div className="h-dvh flex flex-col bg-bg safe-top">
      <div className="flex-none flex items-center gap-3.5 px-[22px] pt-4 pb-4">
        <button onClick={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card flex items-center justify-center">
          <ChevronLeft size={20} />
        </button>
        <div className="flex flex-col gap-0.5">
          <div className="text-[19px] font-extrabold tracking-tight">{t('auth.myShopTitle')}</div>
          <div className="text-[13px] font-semibold text-text-dim">{t('auth.stepThreeOfFour')}</div>
        </div>
      </div>
      <div className="flex-none px-[22px] pb-[22px]">
        <div className="h-[5px] rounded-full bg-fond-planche flex gap-1">
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-primary rounded-full" />
          <div className="flex-1 bg-fond-planche rounded-full" />
        </div>
      </div>

      <div className="flex-1 min-h-0 px-[22px] flex flex-col justify-center gap-[22px] overflow-y-auto no-scrollbar">
        <div className="flex flex-col items-center gap-2.5">
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingLogo}
            className="w-[118px] h-[118px] rounded-full bg-[#F4EDE0] border-2 border-dashed border-[#DDD2C3] flex items-center justify-center relative overflow-hidden disabled:opacity-70"
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <Camera size={34} strokeWidth={1.7} className="text-text-dim" />
            )}
            <div className="absolute right-0.5 bottom-1 w-[38px] h-[38px] rounded-full bg-primary border-[3px] border-bg flex items-center justify-center">
              <Plus size={18} strokeWidth={2.6} className="text-papier" />
            </div>
          </button>
          <div className="text-sm font-bold text-text-muted">{uploadingLogo ? t('settings.uploading') : t('auth.addShopLogo')}</div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopNameLabel')}</div>
          <input
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            className="h-[60px] rounded-2xl border-2 border-primary bg-bg-card px-[18px] text-lg font-bold outline-none"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.neighborhoodLabel')}</div>
          <input
            value={quartier}
            onChange={(e) => setQuartier(e.target.value)}
            className="h-[60px] rounded-2xl border border-border-strong bg-bg-card px-[18px] text-[17px] font-bold outline-none focus:border-primary"
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.exactPositionLabel')}</div>
          <div className="rounded-2xl border border-border-strong bg-bg-card overflow-hidden">
            <div
              className="h-[88px] bg-[#E7EDE6] relative"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(0deg,rgba(46,125,91,.13) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(46,125,91,.13) 0 1px,transparent 1px 22px)',
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-[26px] h-[26px] rounded-full bg-terracotta border-4 border-bg-card shadow-[0_4px_10px_rgba(17,20,24,.25)]" />
              </div>
            </div>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 flex flex-col gap-0.5">
                <div className="text-sm font-bold">9.5370° N, 13.6785° O</div>
                <div className="text-xs font-semibold text-text-dim">{t('auth.precisionMeters', { meters: 8 })}</div>
              </div>
              <button className="px-4 py-2.5 rounded-xl bg-success text-papier text-sm font-extrabold flex items-center gap-1.5">
                <MapPin size={16} />
                {t('auth.locate')}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none px-[22px] pt-4 pb-10">
        <button
          onClick={onContinue}
          disabled={!shopName}
          className="w-full h-[62px] rounded-[18px] bg-primary text-papier text-lg font-extrabold disabled:opacity-50"
        >
          {t('auth.continue')}
        </button>
      </div>
    </div>
  )
}
