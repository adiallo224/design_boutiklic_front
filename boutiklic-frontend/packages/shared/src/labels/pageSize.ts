import type { LabelLayout } from './types'

const POINTS_PER_INCH = 72
const MM_PER_INCH = 25.4

export function mmToPoints(mm: number): number {
  return (mm * POINTS_PER_INCH) / MM_PER_INCH
}

/**
 * Taille de page d'un travail d'impression en points (1/72 pouce), entiers.
 * `expo-print` (mobile) veut `width`/`height` en points et, sur Android, les convertit en `Int` : A4 →
 * 595 × 842, rouleau 50 × 30 mm → 142 × 85. L'arrondi (≤ 0,18 mm) est absorbé par `overflow:hidden` de
 * `.page` et par la marge de sécurité du document (cf. buildLabelsDocument).
 */
export function pageSizePoints(layout: Pick<LabelLayout, 'pageWidthMm' | 'pageHeightMm'>): { width: number; height: number } {
  return { width: Math.round(mmToPoints(layout.pageWidthMm)), height: Math.round(mmToPoints(layout.pageHeightMm)) }
}
