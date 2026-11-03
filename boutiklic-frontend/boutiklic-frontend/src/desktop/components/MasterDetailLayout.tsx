import { useCallback, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent, ReactNode } from 'react'

interface MasterDetailLayoutProps {
  master: ReactNode
  detail: ReactNode
  masterWidth?: string
  /** Active la poignée de redimensionnement de la colonne de gauche (largeur initiale = `masterWidth`, en px). */
  resizable?: { min: number; max: number; storageKey: string }
  /** Écran étroit (< lg) : un seul volet à la fois, plein écran. Absent = les deux colonnes restent côte à côte (comportement historique). */
  activePane?: 'master' | 'detail'
}

const KEY_STEP = 16

function readStoredWidth(storageKey: string): number | null {
  try {
    const value = Number(localStorage.getItem(storageKey))
    return Number.isFinite(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

/** Chrome à deux colonnes pour les écrans maître-détail (W5 revendeurs, W7 clients,
 *  W19 fournisseurs — règle de traduction n°4). Le contenu de chaque colonne reste propre
 *  à l'écran : les données diffèrent trop (accordéon, timeline, transactions) pour une API
 *  générique unique. Avec `resizable`, la colonne de gauche s'élargit à la souris ou au clavier
 *  (flèches gauche/droite sur la poignée), double-clic = largeur par défaut ; le choix est mémorisé. */
export default function MasterDetailLayout({ master, detail, masterWidth = '400px', resizable, activePane }: MasterDetailLayoutProps) {
  const defaultWidth = parseInt(masterWidth, 10)
  const [width, setWidth] = useState<number>(() => (resizable ? (readStoredWidth(resizable.storageKey) ?? defaultWidth) : defaultWidth))
  const drag = useRef<{ startX: number; startWidth: number } | null>(null)

  const clamp = useCallback((value: number) => (resizable ? Math.min(resizable.max, Math.max(resizable.min, value)) : value), [resizable])

  const commit = useCallback(
    (value: number) => {
      const next = clamp(value)
      setWidth(next)
      if (!resizable) return
      try {
        localStorage.setItem(resizable.storageKey, String(next))
      } catch {
        // stockage indisponible (mode privé…) : la largeur reste valable pour la session
      }
    },
    [clamp, resizable],
  )

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { startX: e.clientX, startWidth: width }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (drag.current) setWidth(clamp(drag.current.startWidth + e.clientX - drag.current.startX))
  }
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    commit(drag.current.startWidth + e.clientX - drag.current.startX)
    drag.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') commit(width - KEY_STEP)
    else if (e.key === 'ArrowRight') commit(width + KEY_STEP)
    else return
    e.preventDefault()
  }

  return (
    <div className="flex h-full min-h-0">
      <div
        className={`relative shrink-0 border-r border-border overflow-y-auto ${activePane ? `${activePane === 'detail' ? 'hidden' : 'w-full'} lg:block lg:w-[var(--master-width)]` : ''}`}
        style={activePane ? ({ '--master-width': `${resizable ? width : parseInt(masterWidth, 10)}px` } as CSSProperties) : { width: resizable ? width : masterWidth }}
      >
        {master}
      </div>
      {resizable && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-valuenow={width}
          aria-valuemin={resizable.min}
          aria-valuemax={resizable.max}
          tabIndex={0}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onKeyDown={onKeyDown}
          onDoubleClick={() => commit(defaultWidth)}
          className="hidden lg:block w-1.5 -ml-[3px] shrink-0 z-10 cursor-col-resize touch-none hover:bg-primary/30 focus-visible:bg-primary/40 outline-none"
        />
      )}
      <div className={`flex-1 min-w-0 overflow-y-auto ${activePane === 'master' ? 'hidden lg:block' : ''}`}>{detail}</div>
    </div>
  )
}
