import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'

interface BarcodeScannerModalProps {
  open: boolean
  onDetected: (code: string) => void
  onClose: () => void
}

/** Modale plein écran de scan caméra — premier point de l'app à demander getUserMedia, cf. écrans
 * B2 (caisse), C1 (stock), C3 (fiche produit), C5 (arrivage). Overlay dédié (pas le bottom-sheet
 * habituel de l'app) car la vidéo a besoin de tout l'espace disponible. */
export default function BarcodeScannerModal({ open, onDetected, onClose }: BarcodeScannerModalProps) {
  const { t } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setError(null)

    const reader = new BrowserMultiFormatReader()
    reader
      .decodeFromVideoDevice(undefined, videoRef.current ?? undefined, (result) => {
        // Le callback est rappelé en continu tant qu'aucun code n'est trouvé (avec une erreur
        // NotFoundException à chaque frame) — ce n'est pas une vraie erreur, seul un résultat compte.
        if (cancelled || !result) return
        controlsRef.current?.stop()
        onDetected(result.getText())
      })
      .then((controls) => {
        if (cancelled) {
          controls.stop()
          return
        }
        controlsRef.current = controls
      })
      .catch(() => {
        if (!cancelled) setError(t('components.barcodeScanner.cameraError'))
      })

    return () => {
      cancelled = true
      controlsRef.current?.stop()
      controlsRef.current = null
    }
    // onDetected/onClose volontairement hors dépendances : les redéclencher relancerait le flux caméra.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex-none flex items-center justify-between px-5 pt-5 pb-3">
        <div className="text-papier text-base font-extrabold">{t('components.barcodeScanner.title')}</div>
        <button onClick={onClose} className="w-10 h-10 rounded-xl bg-papier/15 flex items-center justify-center">
          <X size={20} className="text-papier" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex items-center justify-center">
        <video ref={videoRef} muted playsInline className="absolute inset-0 w-full h-full object-cover" />
        {!error && (
          <div
            className="relative w-[78%] max-w-[360px] aspect-[3/2] rounded-2xl border-2 border-papier/80"
            style={{ boxShadow: '0 0 0 2000px rgba(0,0,0,.45)' }}
          />
        )}
      </div>

      <div className="flex-none px-5 pb-9 pt-3">
        {error ? (
          <div className="text-[13px] font-semibold text-danger text-center">{error}</div>
        ) : (
          <div className="text-[13px] font-semibold text-papier/60 text-center">{t('components.barcodeScanner.hint')}</div>
        )}
      </div>
    </div>
  )
}
