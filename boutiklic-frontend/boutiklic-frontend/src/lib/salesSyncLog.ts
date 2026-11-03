import type { QueuedOperation } from '@boutiklic/shared'

/**
 * Historique "déjà envoyé" des ventes synchronisées (écran SyncPending) — module séparé de
 * lib/outbox.ts pour éviter un cycle d'imports : lib/syncEngine.ts branche `recordIfSale` comme
 * onOperationSynced du SyncEngine partagé, et lib/outbox.ts réexpose getSyncLog() pour l'écran.
 */

const SYNC_LOG_KEY = 'boutiklic_sync_log'
const MAX_LOG_ENTRIES = 20
const SALE_OPERATION_TYPE = 'COMPLETE_SALE'

export interface SyncLogEntry {
  completedAt: string
  totalAmount: number
}

export function getSyncLog(): SyncLogEntry[] {
  try {
    return JSON.parse(localStorage.getItem(SYNC_LOG_KEY) ?? '[]') as SyncLogEntry[]
  } catch {
    return []
  }
}

/** Branché comme onOperationSynced du SyncEngine (cf. lib/syncEngine.ts) — ignore tout ce qui n'est
 *  pas une vente (catalogue, dettes, stock... n'ont pas leur place dans "ventes déjà envoyées"). */
export function recordIfSale(operation: QueuedOperation): void {
  if (operation.type !== SALE_OPERATION_TYPE) return
  const payload = JSON.parse(operation.payload) as { payments: { amount: number }[] }
  const totalAmount = payload.payments.reduce((sum, p) => sum + (p.amount || 0), 0)
  const log = getSyncLog()
  log.unshift({ completedAt: new Date().toISOString(), totalAmount })
  localStorage.setItem(SYNC_LOG_KEY, JSON.stringify(log.slice(0, MAX_LOG_ENTRIES)))
}
