import type { LabelLayout } from './types'

export const A4_WIDTH_MM = 210
export const A4_HEIGHT_MM = 297

/** Gabarit de contenu selon la surface d'une étiquette (cf. étude §3.3) : le contenu n'est pas simplement
 *  agrandi, les tailles de texte et de code-barres changent de gabarit. */
export type LabelSizeTier = 'XL' | 'L' | 'M' | 'S'

const round3 = (n: number) => Number(n.toFixed(3))

/** Remplissage interne par gabarit : les imprimantes ne couvrent pas les ~4-5 derniers mm du bord de la feuille. */
const PADDING_BY_TIER: Record<LabelSizeTier, number> = { XL: 10, L: 8, M: 5, S: 4 }
export const ROLL_PADDING_MM = 1.5

export function tierForCell(cellWidthMm: number, cellHeightMm: number): LabelSizeTier {
  const area = cellWidthMm * cellHeightMm
  if (area >= 25000) return 'XL' // A4 complet, A5
  if (area >= 10000) return 'L' // A6
  if (area >= 4000) return 'M' // Standard 8/10/12
  return 'S' // Petit format, rouleaux thermiques
}

export function tierForLayout(layout: LabelLayout): LabelSizeTier {
  return tierForCell(layout.cellWidthMm, layout.cellHeightMm)
}

export function labelsPerPage(layout: LabelLayout): number {
  return layout.columns * layout.rows
}

export interface GridOptions {
  pageWidthMm?: number
  pageHeightMm?: number
  marginLeftMm?: number
  marginTopMm?: number
  gutterXMm?: number
  gutterYMm?: number
  paddingMm?: number
}

/** Divise la page en `columns × rows` parts égales (papier ordinaire découpé, cf. étude §3.3). */
export function gridLayout(columns: number, rows: number, options: GridOptions = {}): LabelLayout {
  const pageWidthMm = options.pageWidthMm ?? A4_WIDTH_MM
  const pageHeightMm = options.pageHeightMm ?? A4_HEIGHT_MM
  const marginLeftMm = options.marginLeftMm ?? 0
  const marginTopMm = options.marginTopMm ?? 0
  const gutterXMm = options.gutterXMm ?? 0
  const gutterYMm = options.gutterYMm ?? 0
  const cellWidthMm = round3((pageWidthMm - 2 * marginLeftMm - (columns - 1) * gutterXMm) / columns)
  const cellHeightMm = round3((pageHeightMm - 2 * marginTopMm - (rows - 1) * gutterYMm) / rows)
  return {
    pageWidthMm,
    pageHeightMm,
    columns,
    rows,
    marginLeftMm,
    marginTopMm,
    gutterXMm,
    gutterYMm,
    cellWidthMm,
    cellHeightMm,
    paddingMm: options.paddingMm ?? PADDING_BY_TIER[tierForCell(cellWidthMm, cellHeightMm)],
  }
}

/** Rouleau thermique : une étiquette = une page de la taille de l'étiquette. */
export function rollLayout(widthMm: number, heightMm: number, paddingMm = ROLL_PADDING_MM): LabelLayout {
  return {
    pageWidthMm: widthMm,
    pageHeightMm: heightMm,
    columns: 1,
    rows: 1,
    marginLeftMm: 0,
    marginTopMm: 0,
    gutterXMm: 0,
    gutterYMm: 0,
    cellWidthMm: widthMm,
    cellHeightMm: heightMm,
    paddingMm,
  }
}

export type A4PresetId = 'a4-full' | 'a5' | 'a6' | 'std-8' | 'std-10' | 'std-12' | 'small-21' | 'small-24'
export type RollPresetId = 'roll-50x30' | 'roll-40x30'
export type PresetId = A4PresetId | RollPresetId

export interface A4Preset {
  id: A4PresetId
  /** Famille affichée à l'utilisateur (le libellé et l'usage recommandé sont traduits côté UI : `labels.families.<family>`). */
  family: 'full' | 'a5' | 'a6' | 'standard' | 'small'
  columns: number
  rows: number
}

/** Les formats de planche A4 proposés (cf. étude §3.3). A5 = ½ A4 : 210 × 148,5 mm en paysage. */
export const A4_PRESETS: readonly A4Preset[] = [
  { id: 'a4-full', family: 'full', columns: 1, rows: 1 },
  { id: 'a5', family: 'a5', columns: 1, rows: 2 },
  { id: 'a6', family: 'a6', columns: 2, rows: 2 },
  { id: 'std-8', family: 'standard', columns: 2, rows: 4 },
  { id: 'std-10', family: 'standard', columns: 2, rows: 5 },
  { id: 'std-12', family: 'standard', columns: 2, rows: 6 },
  { id: 'small-21', family: 'small', columns: 3, rows: 7 },
  { id: 'small-24', family: 'small', columns: 3, rows: 8 },
]

export const ROLL_PRESETS: readonly { id: RollPresetId; widthMm: number; heightMm: number }[] = [
  { id: 'roll-50x30', widthMm: 50, heightMm: 30 },
  { id: 'roll-40x30', widthMm: 40, heightMm: 30 },
]

export function layoutForPreset(id: string): LabelLayout | null {
  const a4 = A4_PRESETS.find((p) => p.id === id)
  if (a4) return gridLayout(a4.columns, a4.rows)
  const roll = ROLL_PRESETS.find((p) => p.id === id)
  if (roll) return rollLayout(roll.widthMm, roll.heightMm)
  return null
}

/** Problèmes d'une grille (surtout pour le format personnalisé saisi par l'utilisateur) ; vide = valide. */
export function validateLayout(layout: LabelLayout): string[] {
  const problems: string[] = []
  const positive = (label: string, value: number) => {
    if (!Number.isFinite(value) || value <= 0) problems.push(`${label} doit être positif`)
  }
  const nonNegative = (label: string, value: number) => {
    if (!Number.isFinite(value) || value < 0) problems.push(`${label} ne peut pas être négatif`)
  }
  positive('pageWidthMm', layout.pageWidthMm)
  positive('pageHeightMm', layout.pageHeightMm)
  positive('cellWidthMm', layout.cellWidthMm)
  positive('cellHeightMm', layout.cellHeightMm)
  nonNegative('marginLeftMm', layout.marginLeftMm)
  nonNegative('marginTopMm', layout.marginTopMm)
  nonNegative('gutterXMm', layout.gutterXMm)
  nonNegative('gutterYMm', layout.gutterYMm)
  nonNegative('paddingMm', layout.paddingMm)
  if (!Number.isInteger(layout.columns) || layout.columns < 1) problems.push('columns doit être un entier ≥ 1')
  if (!Number.isInteger(layout.rows) || layout.rows < 1) problems.push('rows doit être un entier ≥ 1')
  if (problems.length > 0) return problems

  const tolerance = 0.01
  const gridWidth = layout.marginLeftMm + layout.columns * layout.cellWidthMm + (layout.columns - 1) * layout.gutterXMm
  const gridHeight = layout.marginTopMm + layout.rows * layout.cellHeightMm + (layout.rows - 1) * layout.gutterYMm
  if (gridWidth > layout.pageWidthMm + tolerance) problems.push('la grille dépasse la largeur de la page')
  if (gridHeight > layout.pageHeightMm + tolerance) problems.push('la grille dépasse la hauteur de la page')
  if (2 * layout.paddingMm >= Math.min(layout.cellWidthMm, layout.cellHeightMm)) {
    problems.push("le remplissage interne ne laisse aucune place au contenu de l'étiquette")
  }
  return problems
}
