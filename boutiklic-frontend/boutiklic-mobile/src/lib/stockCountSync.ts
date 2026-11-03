import { STOCK_COUNT_SYNC_OPERATION, buildStockCountSyncPayload, parseStockCountSyncPayload } from '@boutiklic/shared'
import { syncEngine } from './syncEngine'

/**
 * Saisie d'inventaire physique hors ligne : la quantité est mise dans la file d'opérations (outbox, idempotente, rejouée toute seule au
 * retour du réseau par le SyncEngine) avec l'heure à laquelle elle a été saisie sur l'appareil. Le brouillon local (lib/stockCountDraft) ne
 * sert plus qu'à AFFICHER « À envoyer » en attendant — l'envoi, lui, est celui de l'outbox.
 */
export function enqueueCountEntry(countId: string, productId: string, quantity: number | null, countedAt: Date = new Date()) {
  return syncEngine.enqueue(
    STOCK_COUNT_SYNC_OPERATION,
    buildStockCountSyncPayload(countId, [{ productId, quantity, countedAt: countedAt.toISOString() }]),
  )
}

/** Articles de ce comptage qui ont une saisie dans la file (en attente OU en échec : une saisie en échec n'est pas orpheline, elle attend l'utilisateur). */
export async function queuedCountProductIds(countId: string): Promise<Set<string>> {
  const queue = await syncEngine.getOutbox()
  const ids = new Set<string>()
  for (const operation of queue) {
    if (operation.type !== STOCK_COUNT_SYNC_OPERATION) continue
    const payload = parseStockCountSyncPayload(operation.payload)
    if (payload?.countId === countId) payload.lines.forEach((l) => ids.add(l.productId))
  }
  return ids
}
