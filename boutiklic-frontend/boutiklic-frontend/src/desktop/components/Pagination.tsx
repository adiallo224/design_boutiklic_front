import type { ReactNode } from 'react'
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface PaginationProps {
  page: number
  pageCount: number
  onPageChange: (page: number) => void
  /** Texte "Affichage de X à Y sur Z ..." — le composant ne connaît pas le nom de l'entité
   *  paginée (articles, ventes...), chaque écran le formate avec sa propre clé i18n. */
  rangeLabel: ReactNode
  /** Sélecteur "Lignes : N" — fourni seulement si l'écran appelant gère un pageSize variable. */
  pageSize?: number
  pageSizeOptions?: number[]
  onPageSizeChange?: (size: number) => void
}

const ARROW_BTN = 'w-8 h-8 rounded-lg bg-bg-card border border-border-strong text-text-muted disabled:opacity-40 flex items-center justify-center flex-none'

/** Pagination réutilisable (numéros de page + première/dernière page + sélecteur de lignes par
 *  page) — même esprit que HorizontalScroller.tsx : une seule implémentation au lieu de la
 *  dupliquer à chaque tableau paginé (Stock, historique des ventes...). */
export default function Pagination({ page, pageCount, onPageChange, rangeLabel, pageSize, pageSizeOptions, onPageSizeChange }: PaginationProps) {
  const { t } = useTranslation()
  const pagesToShow = Array.from({ length: pageCount }, (_, i) => i + 1).filter((p) => p === 1 || p === pageCount || Math.abs(p - page) <= 1)

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2 flex-wrap text-[13px] font-semibold text-text-dim">
        <span>{rangeLabel}</span>
        {pageSizeOptions && onPageSizeChange && (
          <span className="flex items-center gap-1.5">
            <span>· {t('common.rowsPerPageLabel')} :</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 pl-2 pr-6 rounded-lg border border-border-strong bg-bg-card text-xs font-bold text-text outline-none focus:border-primary"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5">
        <button type="button" onClick={() => onPageChange(1)} disabled={page === 1} className={ARROW_BTN} aria-label={t('common.firstPage')}>
          <ChevronsLeft size={15} />
        </button>
        <button type="button" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page === 1} className={ARROW_BTN} aria-label={t('common.previousPage')}>
          <ChevronLeft size={15} />
        </button>
        {pagesToShow.map((p, i) => (
          <span key={p} className="flex items-center gap-1.5">
            {i > 0 && pagesToShow[i - 1] !== p - 1 && <span className="text-text-dim text-xs px-0.5">…</span>}
            <button
              type="button"
              onClick={() => onPageChange(p)}
              className={`w-8 h-8 rounded-lg text-xs font-extrabold flex-none ${p === page ? 'bg-primary text-papier' : 'bg-bg-card border border-border-strong text-text-muted'}`}
            >
              {p}
            </button>
          </span>
        ))}
        <button type="button" onClick={() => onPageChange(Math.min(pageCount, page + 1))} disabled={page === pageCount} className={ARROW_BTN} aria-label={t('common.nextPage')}>
          <ChevronRight size={15} />
        </button>
        <button type="button" onClick={() => onPageChange(pageCount)} disabled={page === pageCount} className={ARROW_BTN} aria-label={t('common.lastPage')}>
          <ChevronsRight size={15} />
        </button>
      </div>
    </div>
  )
}
