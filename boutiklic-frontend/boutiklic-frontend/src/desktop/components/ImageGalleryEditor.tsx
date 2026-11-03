import { useRef, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { fileApi } from '../../lib/fileApi'
import HorizontalScroller from './HorizontalScroller'

interface ImageGalleryEditorProps {
  imageUrls: string[]
  /** Appelé avec la galerie déjà mise à jour (ajout/suppression/nouvelle couverture) — l'appelant
   *  décide s'il enregistre tout de suite (fiche existante) ou seulement à la sauvegarde (création,
   *  cf. plan images multiples §5 : enregistrement immédiat en édition, obligatoirement différé en
   *  création puisque l'article n'existe pas encore). */
  onChange: (next: string[]) => void
  disabled?: boolean
  maxImages?: number
}

/** Bande de vignettes défilable horizontalement : ajout (upload immédiat), suppression, définir
 *  comme couverture, agrandissement au clic (cf. plan images multiples §3). Un seul composant pour
 *  la création et l'édition — ProductSheetModalDesktop consolide déjà les deux dans une seule modale. */
export default function ImageGalleryEditor({ imageUrls, onChange, disabled, maxImages = 8 }: ImageGalleryEditorProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const atLimit = imageUrls.length >= maxImages

  const handleAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || atLimit) return
    setUploading(true)
    try {
      const { url } = await fileApi.upload(file)
      onChange([...imageUrls, url])
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (url: string) => onChange(imageUrls.filter((u) => u !== url))
  const handleSetCover = (url: string) => onChange([url, ...imageUrls.filter((u) => u !== url)])

  return (
    <div className="flex flex-col gap-2">
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAdd} />
      <HorizontalScroller gapClassName="gap-2.5">
        {imageUrls.map((url, index) => (
          <div key={url} className="relative w-[100px] h-[100px] flex-none rounded-xl overflow-hidden border border-border-strong bg-bg-elevated group">
            <button type="button" onClick={() => setLightboxUrl(url)} className="w-full h-full block">
              <img src={url} alt="" className="w-full h-full object-cover" />
            </button>
            {index === 0 && (
              <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-bold pointer-events-none">
                {t('inventoryCatalog.coverBadge')}
              </span>
            )}
            {!disabled && (
              <button
                type="button"
                onClick={() => handleRemove(url)}
                aria-label={t('inventoryCatalog.removeImage')}
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center"
              >
                <X size={12} />
              </button>
            )}
            {!disabled && index !== 0 && (
              <button
                type="button"
                onClick={() => handleSetCover(url)}
                className="absolute bottom-1 left-1 right-1 px-1 py-0.5 rounded-md bg-black/60 text-white text-[9px] font-bold opacity-0 group-hover:opacity-100 transition-opacity"
              >
                {t('inventoryCatalog.setAsCover')}
              </button>
            )}
          </div>
        ))}
        {!disabled && !atLimit && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-[100px] h-[100px] flex-none rounded-xl border-2 border-dashed border-[#DDD2C3] bg-bg-elevated flex flex-col items-center justify-center gap-1 disabled:opacity-70"
          >
            <Camera size={20} className="text-text-dim" />
            <span className="text-text-muted text-[10px] font-semibold text-center px-1">
              {uploading ? t('settings.uploading') : t('inventoryCatalog.addImage')}
            </span>
          </button>
        )}
      </HorizontalScroller>
      {atLimit && <span className="text-[11px] text-text-dim">{t('inventoryCatalog.imageLimitReached', { max: maxImages })}</span>}

      {lightboxUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-6" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-full rounded-xl" />
        </div>
      )}
    </div>
  )
}
