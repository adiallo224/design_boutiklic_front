import { useCallback, useEffect, useState } from 'react'
import type { QueuedOperation } from '@boutiklic/shared'
import { syncEngine } from '../lib/syncEngine'
import { getSyncLog, type SyncLogEntry } from '../lib/outbox'

/** Vue réactive de la file d'attente hors-ligne (cf. lib/syncEngine.ts) — TOUTES les opérations en
 *  attente, pas seulement les ventes (catalogue, dettes, stock, fournisseurs comprises, cf. phases
 *  3-6 du plan offline-first) : une seule file, une seule bannière, un seul écran de synchro.
 *  Aucun déclencheur réseau ici — syncEngine.startAutoSync() (appelé une fois à la racine de l'app,
 *  cf. App.tsx) couvre déjà la resynchro au retour réseau et au lancement si déjà en ligne. */
export function useOutbox() {
  const [queue, setQueue] = useState<QueuedOperation[]>([])
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([])
  const [isSyncing, setIsSyncing] = useState(false)

  const refresh = useCallback(() => {
    syncEngine.getOutbox().then(setQueue)
    setSyncLog(getSyncLog())
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    return syncEngine.subscribeOutboxChanges(refresh)
  }, [refresh])

  const sync = useCallback(async () => {
    setIsSyncing(true)
    try {
      return await syncEngine.processOutbox()
    } finally {
      setIsSyncing(false)
      refresh()
    }
  }, [refresh])

  return {
    queue,
    pendingCount: queue.filter((op) => op.status === 'PENDING').length,
    failedCount: queue.filter((op) => op.status === 'FAILED').length,
    syncLog,
    isSyncing,
    sync,
  }
}
