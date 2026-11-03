import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface HorizontalScrollerProps {
  children: ReactNode
  /** Classe(s) d'espacement du conteneur défilant (ex. "gap-2", "gap-2.5") — laisse chaque
   *  appelant garder son propre rythme visuel plutôt que d'en imposer un. */
  gapClassName?: string
  /** Distance parcourue par clic sur une flèche, en pixels (variante "default"). */
  scrollAmount?: number
  /** "default" : flèches carrées à bordure, toujours actives, hors de tout cadre.
   *  "inline" : l'ensemble est encadré (fond + bordure arrondie, cf. `className`), petites
   *  flèches rondes qui se grisent aux extrémités, défilement proportionnel à la largeur visible. */
  variant?: 'default' | 'inline'
  /** Classes de l'enveloppe (marges, padding, largeur max…). */
  className?: string
  /** Classes ajoutées à la piste qui défile (ex. "snap-x snap-mandatory text-center"). */
  trackClassName?: string
}

const DEFAULT_ARROW = 'w-8 h-8 rounded-lg bg-bg-card border border-border-strong flex items-center justify-center text-text-dim hover:bg-bg-elevated flex-none'
const INLINE_ARROW = 'w-6 h-6 rounded-full flex items-center justify-center flex-none text-text-muted hover:bg-bg-elevated hover:text-text disabled:opacity-30 disabled:hover:bg-transparent transition-colors'

/** Rangée à défilement horizontal + flèches gauche/droite, réutilisée partout où une liste de
 *  pastilles/boutons peut dépasser la largeur disponible (catégories POS, moyens de paiement de
 *  la modale de vente, filtres catégorie/statut du stock, bandeau et filtres par mode de
 *  règlement du journal de caisse...). Une seule implémentation au lieu d'un ref+scrollBy
 *  dupliqué à chaque écran. */
export default function HorizontalScroller({
  children,
  gapClassName = 'gap-2',
  scrollAmount = 140,
  variant = 'default',
  className = '',
  trackClassName = '',
}: HorizontalScrollerProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)
  const inline = variant === 'inline'

  const updateArrows = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 1)
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1)
  }, [])

  // Recalcul à chaque rendu (setState identique = no-op) pour suivre les changements de contenu,
  // plus au redimensionnement du conteneur.
  useEffect(() => {
    if (inline) updateArrows()
  })
  useEffect(() => {
    const el = scrollRef.current
    if (!inline || !el) return
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => ro.disconnect()
  }, [inline, updateArrows])

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollRef.current
    if (!el) return
    const amount = inline ? el.clientWidth * 0.7 : scrollAmount
    el.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  const arrowClass = inline ? INLINE_ARROW : DEFAULT_ARROW
  const iconSize = inline ? 16 : 15

  return (
    <div className={`flex items-center ${inline ? 'gap-1 bg-bg rounded-xl border border-border' : 'gap-1.5'} ${className}`}>
      <button
        type="button"
        onClick={() => scrollByDir(-1)}
        disabled={inline && !canLeft}
        className={arrowClass}
        aria-label={t('common.scrollLeft')}
      >
        <ChevronLeft size={iconSize} />
      </button>
      <div
        ref={scrollRef}
        onScroll={inline ? updateArrows : undefined}
        className={`flex-1 min-w-0 flex items-center ${gapClassName} overflow-x-auto no-scrollbar scroll-smooth ${trackClassName}`}
      >
        {children}
      </div>
      <button
        type="button"
        onClick={() => scrollByDir(1)}
        disabled={inline && !canRight}
        className={arrowClass}
        aria-label={t('common.scrollRight')}
      >
        <ChevronRight size={iconSize} />
      </button>
    </div>
  )
}
