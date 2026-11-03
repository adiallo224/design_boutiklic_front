/**
 * Inventaire physique (comptage du stock) — contrat partagé web / desktop / mobile avec `/api/v1/stock-counts` (boutiklic-core,
 * StockCountController) et calculs d'écarts affichés pendant la revue. Aucun calcul n'engage le stock : la validation côté serveur
 * recalcule tout (cible = quantité comptée + mouvements survenus depuis le comptage), ce qui est affiché ici n'est qu'une lecture.
 */

export type StockCountStatus = 'COUNTING' | 'PENDING_REVIEW' | 'VALIDATED' | 'CANCELLED'

/** Un comptage ouvert occupe son dépôt : un seul à la fois. */
export function isOpenStockCount(status: StockCountStatus): boolean {
  return status === 'COUNTING' || status === 'PENDING_REVIEW'
}

/** Code d'erreur d'une ligne d'un fichier importé (cf. ImportStockCountUseCase.ErrorCode côté serveur). */
export const STOCK_COUNT_IMPORT_ERROR_CODES = [
  'INVALID_QUANTITY',
  'MISSING_REFERENCE',
  'UNKNOWN_PRODUCT',
  'NOT_IN_COUNT',
  'AMBIGUOUS_BARCODE',
  'DUPLICATE',
] as const

export type StockCountImportErrorCode = (typeof STOCK_COUNT_IMPORT_ERROR_CODES)[number]

export interface StockCountLineValues {
  /** null pendant un comptage aveugle, pour qui n'a pas le droit de le voir. */
  systemQty: number | null
  /** null = pas encore compté. */
  countedQty: number | null
  /** Variation réellement appliquée au stock ; renseignée à la validation seulement. */
  appliedDelta?: number | null
}

/** Écart = compté − système (négatif = manque). null tant que l'un des deux manque : un article non compté n'a pas d'écart. */
export function countGap(line: StockCountLineValues): number | null {
  if (line.countedQty == null || line.systemQty == null) return null
  return line.countedQty - line.systemQty
}

export interface StockCountSummary {
  total: number
  counted: number
  uncounted: number
  /** Articles comptés dont l'écart n'est pas nul. */
  withGap: number
  /** Unités en trop (somme des écarts positifs). */
  surplusUnits: number
  /** Unités manquantes, en valeur positive (somme des écarts négatifs). */
  shortageUnits: number
}

export function summarizeStockCount(lines: readonly StockCountLineValues[]): StockCountSummary {
  let counted = 0
  let withGap = 0
  let surplusUnits = 0
  let shortageUnits = 0
  for (const line of lines) {
    if (line.countedQty != null) counted++
    const gap = countGap(line)
    if (gap == null || gap === 0) continue
    withGap++
    if (gap > 0) surplusUnits += gap
    else shortageUnits += -gap
  }
  return { total: lines.length, counted, uncounted: lines.length - counted, withGap, surplusUnits, shortageUnits }
}

/** Avancement de la saisie en pourcentage entier (0 si le comptage est vide). */
export function stockCountProgressPercent(summary: Pick<StockCountSummary, 'total' | 'counted'>): number {
  return summary.total === 0 ? 0 : Math.round((summary.counted / summary.total) * 100)
}

export type StockCountLineFilter = 'all' | 'uncounted' | 'counted' | 'gaps'

export function filterStockCountLines<T extends StockCountLineValues>(lines: readonly T[], filter: StockCountLineFilter): T[] {
  switch (filter) {
    case 'uncounted':
      return lines.filter((l) => l.countedQty == null)
    case 'counted':
      return lines.filter((l) => l.countedQty != null)
    case 'gaps':
      return lines.filter((l) => {
        const gap = countGap(l)
        return gap != null && gap !== 0
      })
    default:
      return [...lines]
  }
}

/** Valeur d'un écart au coût unitaire courant de l'article (négatif = perte). Lecture indicative, hors taxe. */
export function stockCountGapValue(gap: number, unitCost: number): number {
  return gap * unitCost
}

/** Valeur totale des écarts des lignes comptées dont le coût est connu ; `unitCostOf` renvoie undefined pour un article inconnu. */
export function stockCountNetGapValue<T extends StockCountLineValues & { productId: string }>(
  lines: readonly T[],
  unitCostOf: (productId: string) => number | undefined,
): number {
  let total = 0
  for (const line of lines) {
    const gap = countGap(line)
    const cost = unitCostOf(line.productId)
    if (gap != null && gap !== 0 && cost != null) total += stockCountGapValue(gap, cost)
  }
  return total
}

/** Une saisie vide veut dire « pas compté » ; sinon un entier ≥ 0. null = saisie invalide (à signaler, jamais à envoyer). */
export function parseCountedInput(raw: string): number | 'empty' | null {
  const text = raw.replace(/\s/g, '').replace(',', '.')
  if (text === '') return 'empty'
  if (!/^\d+(\.0+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isSafeInteger(value) ? value : null
}

/** Type de l'opération d'Operation Outbox qui rejoue des saisies de comptage (cf. RecordStockCountLinesSyncOperationHandlerAdapter côté serveur). */
export const STOCK_COUNT_SYNC_OPERATION = 'RECORD_STOCK_COUNT_LINES'

export interface StockCountSyncLine {
  productId: string
  /** null = retirer le comptage de l'article. */
  quantity: number | null
  /** Heure de la saisie sur l'appareil (ISO-8601) : c'est elle, et non l'heure de réception, que la validation compare aux mouvements de stock. */
  countedAt: string
}

export interface StockCountSyncPayload {
  countId: string
  lines: StockCountSyncLine[]
}

export function buildStockCountSyncPayload(countId: string, lines: StockCountSyncLine[]): string {
  const payload: StockCountSyncPayload = { countId, lines }
  return JSON.stringify(payload)
}

/** Relit le contenu d'une opération en file ; null si ce n'en est pas une (ou si elle est illisible) plutôt que de lever. */
export function parseStockCountSyncPayload(raw: string): StockCountSyncPayload | null {
  try {
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return null
    const { countId, lines } = parsed as Record<string, unknown>
    if (typeof countId !== 'string' || !Array.isArray(lines)) return null
    const valid: StockCountSyncLine[] = []
    for (const line of lines) {
      if (typeof line !== 'object' || line === null) return null
      const { productId, quantity, countedAt } = line as Record<string, unknown>
      if (typeof productId !== 'string' || typeof countedAt !== 'string') return null
      if (quantity !== null && !(typeof quantity === 'number' && Number.isInteger(quantity) && quantity >= 0)) return null
      valid.push({ productId, quantity: quantity as number | null, countedAt })
    }
    return { countId, lines: valid }
  } catch {
    return null
  }
}
