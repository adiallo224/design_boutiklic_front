import { useEffect, useRef, useState } from 'react'

const MM_TO_PX = 96 / 25.4
/** Marge autour de la page dans le document (ombre + fond gris de l'aperçu écran). */
const PAGE_GUTTER_PX = 24

interface LabelPreviewProps {
  /** Document HTML de `buildLabelsDocument` ; `null` = rien à montrer. */
  html: string | null
  pageWidthMm: number
  /** Hauteur de la zone d'aperçu (px). */
  height?: number
  title: string
  emptyText: string
}

/**
 * Aperçu fidèle : le MÊME document HTML que celui qui sera imprimé, affiché dans un iframe isolé et
 * réduit à la largeur disponible (`transform: scale`). Le défilement interne parcourt les pages.
 * `sandbox=""` : le document est généré par nous (noms échappés) mais ne doit de toute façon jamais
 * exécuter de script.
 */
export default function LabelPreview({ html, pageWidthMm, height = 560, title, emptyText }: LabelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerWidth, setContainerWidth] = useState(0)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  const frameWidth = pageWidthMm * MM_TO_PX + PAGE_GUTTER_PX
  const scale = containerWidth > 0 ? Math.min(1, containerWidth / frameWidth) : 1

  return (
    <div ref={containerRef} className="relative w-full overflow-hidden rounded-xl bg-[#E6E6E6] border border-border" style={{ height }}>
      {html ? (
        <iframe
          title={title}
          srcDoc={html}
          sandbox=""
          className="absolute left-0 top-0 border-0 bg-transparent"
          style={{ width: frameWidth, height: height / scale, transform: `scale(${scale})`, transformOrigin: '0 0' }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm font-semibold text-text-dim">{emptyText}</div>
      )}
    </div>
  )
}
