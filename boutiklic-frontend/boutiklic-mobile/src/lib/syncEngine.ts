import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
import { SyncEngine, type SyncStorage, type SyncTransport, type QueuedOperation, type PushResponse, type PullResponse } from '@boutiklic/shared'
import { apiClient, ApiError, NetworkError, toErrorMessage } from './apiClient'
import { networkMonitor } from './networkMonitor'
import { recordIfSale } from './salesSyncLog'
import { onCountOperationSynced } from './stockCountSyncHooks'

/**
 * Câblage plateforme du SyncEngine partagé (cf. @boutiklic/shared/sync, plan offline-first).
 * Instance unique consommée à la fois par lib/outbox.ts (ventes, type COMPLETE_SALE) et par les
 * écrans catalogue/dettes/stock/fournisseurs qui appellent syncEngine.enqueue() directement
 * (phases 3-6) — une seule file, une seule bannière, un seul écran de synchro en attente.
 */

const OUTBOX_KEY = 'boutiklic_sync_engine_outbox'
const CURSOR_KEY = 'boutiklic_sync_engine_cursor'

const storage: SyncStorage = {
  async getCursor() {
    const raw = await AsyncStorage.getItem(CURSOR_KEY)
    return raw ? Number(raw) : 0
  },
  async setCursor(cursor) {
    await AsyncStorage.setItem(CURSOR_KEY, String(cursor))
  },
  async getOutbox() {
    try {
      return JSON.parse((await AsyncStorage.getItem(OUTBOX_KEY)) ?? '[]') as QueuedOperation[]
    } catch {
      return []
    }
  },
  async setOutbox(queue) {
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(queue))
  },
}

const transport: SyncTransport = {
  push(operation) {
    return apiClient.post<PushResponse>('/sync/push', operation, {
      headers: { 'X-Idempotency-Key': operation.operationId },
    })
  },
  pull(cursor, limit) {
    const query = limit ? `?cursor=${cursor}&limit=${limit}` : `?cursor=${cursor}`
    return apiClient.get<PullResponse>(`/sync/pull${query}`)
  },
}

export const syncEngine = new SyncEngine({
  storage,
  transport,
  network: networkMonitor,
  generateOperationId: () => Crypto.randomUUID(),
  onOperationSynced: async (operation) => {
    await recordIfSale(operation)
    await onCountOperationSynced(operation)
  },
  errorClassifier: {
    classify(error) {
      if (error instanceof NetworkError) return 'network'
      if (error instanceof ApiError && error.status === 409) return 'conflict'
      return 'rejected'
    },
    describe(error) {
      return toErrorMessage(error)
    },
  },
})
