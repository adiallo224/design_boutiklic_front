import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  /** Largeur fixe en px selon l'écran (880/820/760/720 dans le spec bureau). */
  width?: number
  title?: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
}

/** Modale bureau centrée (remplace l'idiome mobile `inset-x-5 top-1/3` des modales existantes,
 *  qui ne sont pas réutilisées ici) — fermeture Échap, verrou de scroll pendant l'ouverture. */
export default function Modal({ open, onClose, width = 560, title, subtitle, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-6">
        <div
          className="w-full max-h-[94vh] sm:max-h-[88vh] overflow-y-auto rounded-2xl bg-bg-card border border-border-strong shadow-2xl flex flex-col"
          style={{ maxWidth: width }}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || subtitle) && (
            <div className="flex items-start justify-between gap-3 sm:gap-4 px-4 sm:px-6 pt-4 sm:pt-6 pb-3 sm:pb-4 border-b border-border shrink-0 print:hidden">
              <div className="min-w-0">
                {title && <h2 className="font-display text-lg sm:text-xl font-extrabold text-text break-words">{title}</h2>}
                {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full p-1.5 hover:bg-bg-elevated text-text-muted shrink-0"
                aria-label="Fermer"
              >
                <X size={20} />
              </button>
            </div>
          )}
          <div className="px-4 sm:px-6 py-4 sm:py-5 flex-1 min-w-0">{children}</div>
          {footer && <div className="px-4 sm:px-6 py-4 border-t border-border flex flex-wrap justify-end gap-2.5 shrink-0">{footer}</div>}
        </div>
      </div>
    </>
  )
}
