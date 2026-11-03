/**
 * Exports d'inventaire (CSV, Excel, PDF) — contrat partagé web / desktop / mobile avec
 * `GET /api/v1/inventory/export` (boutiklic-core, InventoryExportController).
 * L'inventaire « par catégorie » ou « par dépôt » n'est pas un type à part : c'est le rapport
 * général filtré (`categoryId`, `depotId`).
 */

export type InventoryReportType = 'general' | 'valuation' | 'low_stock' | 'movements'

export type InventoryExportFormat = 'xlsx' | 'csv' | 'pdf'

export interface InventoryReportDef {
  type: InventoryReportType
  /** Expose des coûts d'achat : le serveur exige PERM_REPORT_FINANCIAL_VIEW (OWNER par défaut). */
  financial: boolean
  /** Peut inclure prix de vente et coût d'achat (case « inclure les prix ») — exige alors la permission financière. */
  supportsPrices: boolean
  /** Filtre par période et par type d'opération. */
  supportsPeriod: boolean
}

export const INVENTORY_REPORTS: readonly InventoryReportDef[] = [
  { type: 'general', financial: false, supportsPrices: true, supportsPeriod: false },
  { type: 'valuation', financial: true, supportsPrices: false, supportsPeriod: false },
  { type: 'low_stock', financial: false, supportsPrices: false, supportsPeriod: false },
  { type: 'movements', financial: false, supportsPrices: false, supportsPeriod: true },
]

export const INVENTORY_EXPORT_FORMATS: readonly InventoryExportFormat[] = ['xlsx', 'pdf', 'csv']

/** Types d'opération filtrables sur le rapport des mouvements (StockMovementType côté serveur). */
export const INVENTORY_MOVEMENT_TYPES = [
  'SALE',
  'INTAKE',
  'ADJUSTMENT',
  'RETURN',
  'CONSIGNMENT_OUT',
  'CONSIGNMENT_RETURN',
  'TRANSFER_OUT',
  'TRANSFER_IN',
] as const

export type InventoryMovementType = (typeof INVENTORY_MOVEMENT_TYPES)[number]

export interface InventoryExportParams {
  type: InventoryReportType
  format: InventoryExportFormat
  /** null/absent = tous les dépôts. */
  depotId?: string | null
  /** null/absent = toutes les catégories. */
  categoryId?: string | null
  /** Rapport général uniquement. */
  includePrices?: boolean
  /** YYYY-MM-DD, mouvements uniquement ; absent = les 30 derniers jours. */
  from?: string | null
  to?: string | null
  /** Mouvements uniquement ; absent = tous les types. */
  movementType?: InventoryMovementType | null
}

export function inventoryReportDef(type: InventoryReportType): InventoryReportDef {
  const def = INVENTORY_REPORTS.find((r) => r.type === type)
  if (!def) throw new Error(`Type de rapport inconnu : ${type}`)
  return def
}

/** Query string de l'endpoint d'export, sans « ? ». N'envoie que les paramètres que le rapport choisi sait lire :
 *  un filtre laissé dans l'écran après un changement de type ne doit pas fuiter dans la requête. */
export function buildInventoryExportQuery(params: InventoryExportParams): string {
  const def = inventoryReportDef(params.type)
  const query = new URLSearchParams({ type: params.type, format: params.format })
  if (params.depotId) query.set('depotId', params.depotId)
  if (params.categoryId) query.set('categoryId', params.categoryId)
  if (def.supportsPrices && params.includePrices) query.set('includePrices', 'true')
  if (def.supportsPeriod) {
    if (params.from) query.set('from', params.from)
    if (params.to) query.set('to', params.to)
    if (params.movementType) query.set('movementType', params.movementType)
  }
  return query.toString()
}

/** Nom de fichier proposé à l'enregistrement, ex. `inventaire-stock-faible-2026-10-24.xlsx`. */
export function inventoryExportFileName(type: InventoryReportType, format: InventoryExportFormat, isoDate: string): string {
  return `inventaire-${type.replace(/_/g, '-')}-${isoDate}.${format}`
}
