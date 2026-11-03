import { STOCK_COUNT_SYNC_OPERATION, parseStockCountSyncPayload, type QueuedOperation } from '@boutiklic/shared'
import { removePendingIfSame } from './stockCountDraft'

/**
 * Appelé par le SyncEngine après CHAQUE opération synchronisée avec succès (cf. lib/syncEngine.ts, onOperationSynced) : quand une saisie de
 * comptage mise en file est partie, elle n'a plus à figurer dans le brouillon local « À envoyer ». Séparé de lib/stockCountSync.ts (qui
 * dépend du SyncEngine) pour que le SyncEngine puisse l'importer sans dépendance circulaire.
 */
export async function onCountOperationSynced(operation: QueuedOperation): Promise<void> {
  if (operation.type !== STOCK_COUNT_SYNC_OPERATION) return
  const payload = parseStockCountSyncPayload(operation.payload)
  if (!payload) return
  await removePendingIfSame(payload.countId, payload.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })))
}
