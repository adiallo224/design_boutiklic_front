import { describe, expect, it, vi } from 'vitest'
import {
  SyncEngine,
  type ChangeLogEntry,
  type NetworkMonitor,
  type PullResponse,
  type PushResponse,
  type QueuedOperation,
  type SyncErrorClassifier,
  type SyncStorage,
  type SyncTransport,
} from '@boutiklic/shared'

/** Le SyncEngine partagé (packages/shared/src/sync) n'a pas de runner de test dédié — testé ici,
 *  depuis l'app qui en consomme déjà le code source directement (cf. package.json de packages/shared,
 *  pas de build séparé). Fakes en mémoire plutôt que des mocks Vitest : plus simple à lire pour un
 *  moteur qui n'est qu'orchestration de storage/transport injectés. */

function inMemoryStorage(): SyncStorage {
  let cursor = 0
  let outbox: QueuedOperation[] = []
  return {
    async getCursor() {
      return cursor
    },
    async setCursor(next) {
      cursor = next
    },
    async getOutbox() {
      return outbox
    },
    async setOutbox(next) {
      outbox = next
    },
  }
}

class NetworkError extends Error {}
class ApiError extends Error {
  constructor(public status: number) {
    super('api error')
  }
}

const classifier: SyncErrorClassifier = {
  classify(error) {
    if (error instanceof NetworkError) return 'network'
    if (error instanceof ApiError && error.status === 409) return 'conflict'
    return 'rejected'
  },
  describe(error) {
    return error instanceof Error ? error.message : 'unknown'
  },
}

const noopNetwork: NetworkMonitor = {
  async isOnline() {
    return true
  },
  subscribe() {
    return () => {}
  },
}

function engineWith(transport: SyncTransport, storage: SyncStorage = inMemoryStorage()) {
  let seq = 0
  return {
    storage,
    engine: new SyncEngine({
      storage,
      transport,
      network: noopNetwork,
      errorClassifier: classifier,
      generateOperationId: () => `op-${++seq}`,
    }),
  }
}

describe('SyncEngine.processOutbox', () => {
  it('removes a successfully pushed operation from the outbox', async () => {
    const push = vi.fn().mockResolvedValue({ resultPayload: '{}' } satisfies PushResponse)
    const { engine, storage } = engineWith({ push, pull: vi.fn() })

    await engine.enqueue('CREATE_SALE', '{}')
    const result = await engine.processOutbox()

    expect(result).toEqual({ synced: 1, failed: 0 })
    expect(await storage.getOutbox()).toEqual([])
    expect(push).toHaveBeenCalledOnce()
  })

  it('stops at the first network failure, leaving the operation PENDING', async () => {
    const push = vi.fn().mockRejectedValue(new NetworkError())
    const { engine, storage } = engineWith({ push, pull: vi.fn() })

    await engine.enqueue('CREATE_SALE', '{}')
    await engine.enqueue('ADD_LINE', '{}')
    const result = await engine.processOutbox()

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(push).toHaveBeenCalledOnce() // s'arrête au premier échec, ne tente pas le second
    const queue = await storage.getOutbox()
    expect(queue).toHaveLength(2)
    expect(queue[0].status).toBe('PENDING')
  })

  it('marks a business rejection FAILED but continues to the next operation', async () => {
    const push = vi.fn().mockRejectedValueOnce(new ApiError(422)).mockResolvedValueOnce({ resultPayload: '{}' })
    const { engine, storage } = engineWith({ push, pull: vi.fn() })

    await engine.enqueue('CREATE_SALE', '{}')
    await engine.enqueue('ADD_LINE', '{}')
    const result = await engine.processOutbox()

    expect(result).toEqual({ synced: 1, failed: 1 })
    expect(push).toHaveBeenCalledTimes(2)
    const queue = await storage.getOutbox()
    expect(queue).toHaveLength(1)
    expect(queue[0].status).toBe('FAILED')
  })

  it('invokes onConflict before marking a conflicting operation FAILED', async () => {
    const push = vi.fn().mockRejectedValue(new ApiError(409))
    const onConflict = vi.fn()
    const storage = inMemoryStorage()
    const engine = new SyncEngine({
      storage,
      transport: { push, pull: vi.fn() },
      network: noopNetwork,
      errorClassifier: classifier,
      generateOperationId: () => 'op-1',
      onConflict,
    })

    await engine.enqueue('CREATE_SALE', '{}')
    await engine.processOutbox()

    expect(onConflict).toHaveBeenCalledOnce()
    const queue = await storage.getOutbox()
    expect(queue[0].status).toBe('FAILED')
  })

  it('skips FAILED operations already in the queue without retrying them', async () => {
    const push = vi.fn().mockResolvedValue({ resultPayload: '{}' })
    const storage = inMemoryStorage()
    await storage.setOutbox([
      { operationId: 'op-1', type: 'X', payload: '{}', createdAt: 'now', status: 'FAILED', lastError: 'boom' },
    ])
    const { engine } = engineWith({ push, pull: vi.fn() }, storage)

    const result = await engine.processOutbox()

    expect(result).toEqual({ synced: 0, failed: 0 })
    expect(push).not.toHaveBeenCalled()
  })

  it('ignores a concurrent processOutbox call while one is already running', async () => {
    let resolvePush: (() => void) | undefined
    const push = vi.fn().mockImplementation(
      () => new Promise<PushResponse>((resolve) => {
        resolvePush = () => resolve({ resultPayload: '{}' })
      }),
    )
    const { engine } = engineWith({ push, pull: vi.fn() })
    await engine.enqueue('CREATE_SALE', '{}')

    const first = engine.processOutbox()
    // Laisse `first` avancer jusqu'à son appel à push() (plusieurs microtasks entre les deux : lecture
    // de la file, etc.) avant de démarrer `second` — sans quoi le test ne prouverait rien sur `syncing`.
    await vi.waitFor(() => expect(push).toHaveBeenCalled())
    const second = engine.processOutbox() // tapé pendant que le premier tourne encore

    resolvePush?.()
    const [firstResult, secondResult] = await Promise.all([first, second])

    expect(push).toHaveBeenCalledOnce() // pas rejoué en double
    expect(firstResult).toEqual({ synced: 1, failed: 0 })
    expect(secondResult).toEqual({ synced: 0, failed: 0 }) // no-op, cf. garde `syncing`
  })

  it('calls onOperationSynced after a successful push', async () => {
    const push = vi.fn().mockResolvedValue({ resultPayload: '{}' })
    const onOperationSynced = vi.fn()
    const storage = inMemoryStorage()
    const engine = new SyncEngine({
      storage,
      transport: { push, pull: vi.fn() },
      network: noopNetwork,
      errorClassifier: classifier,
      generateOperationId: () => 'op-1',
      onOperationSynced,
    })

    await engine.enqueue('COMPLETE_SALE', '{"amountPaid":15000}')
    await engine.processOutbox()

    expect(onOperationSynced).toHaveBeenCalledOnce()
    expect(onOperationSynced.mock.calls[0][0]).toMatchObject({ operationId: 'op-1', type: 'COMPLETE_SALE' })
  })
})

describe('SyncEngine retry/discard/getOutbox', () => {
  it('retryOperation resets a FAILED operation to PENDING and clears lastError', async () => {
    const { engine, storage } = engineWith({ push: vi.fn(), pull: vi.fn() })
    await storage.setOutbox([
      { operationId: 'op-1', type: 'X', payload: '{}', createdAt: 'now', status: 'FAILED', lastError: 'boom' },
    ])

    await engine.retryOperation('op-1')

    const queue = await storage.getOutbox()
    expect(queue[0].status).toBe('PENDING')
    expect(queue[0].lastError).toBeUndefined()
  })

  it('discardOperation removes the operation from the outbox', async () => {
    const { engine, storage } = engineWith({ push: vi.fn(), pull: vi.fn() })
    await storage.setOutbox([
      { operationId: 'op-1', type: 'X', payload: '{}', createdAt: 'now', status: 'FAILED', lastError: 'boom' },
    ])

    await engine.discardOperation('op-1')

    expect(await storage.getOutbox()).toEqual([])
  })

  it('subscribeOutboxChanges fires on enqueue and on a successful sync, regardless of caller', async () => {
    const push = vi.fn().mockResolvedValue({ resultPayload: '{}' })
    const { engine } = engineWith({ push, pull: vi.fn() })
    const changes = vi.fn()
    const unsubscribe = engine.subscribeOutboxChanges(changes)

    await engine.enqueue('CREATE_PRODUCT', '{}') // ex. enqueue direct, hors lib/outbox.ts
    expect(changes).toHaveBeenCalledTimes(1)

    await engine.processOutbox()
    expect(changes).toHaveBeenCalledTimes(2) // succès -> retiré de la file

    unsubscribe()
    await engine.enqueue('CREATE_PRODUCT', '{}')
    expect(changes).toHaveBeenCalledTimes(2) // plus d'appels après désabonnement
  })

  it('subscribeOutboxChanges fires when an operation is marked FAILED and when discarded', async () => {
    const push = vi.fn().mockRejectedValue(new ApiError(422))
    const { engine, storage } = engineWith({ push, pull: vi.fn() })
    const changes = vi.fn()
    engine.subscribeOutboxChanges(changes)

    await engine.enqueue('X', '{}')
    await engine.processOutbox()
    expect(changes).toHaveBeenCalledTimes(2) // enqueue + markFailed

    const [{ operationId }] = await storage.getOutbox()
    await engine.discardOperation(operationId)
    expect(changes).toHaveBeenCalledTimes(3)
  })

  it('getOutbox returns the current queue', async () => {
    const { engine } = engineWith({ push: vi.fn(), pull: vi.fn() })
    await engine.enqueue('CREATE_SALE', '{}')

    const queue = await engine.getOutbox()

    expect(queue).toHaveLength(1)
    expect(queue[0].type).toBe('CREATE_SALE')
  })
})

describe('SyncEngine.startAutoSync', () => {
  it('syncs immediately if already online, in addition to subscribing to future changes', async () => {
    const pull = vi.fn().mockResolvedValue({ entries: [], nextCursor: 0, hasMore: false } satisfies PullResponse)
    const storage = inMemoryStorage()
    let listener: ((online: boolean) => void) | undefined
    const network: NetworkMonitor = {
      async isOnline() {
        return true
      },
      subscribe(l) {
        listener = l
        return () => {}
      },
    }
    const engine = new SyncEngine({
      storage,
      transport: { push: vi.fn(), pull },
      network,
      errorClassifier: classifier,
      generateOperationId: () => 'op-1',
    })

    engine.startAutoSync()

    await vi.waitFor(() => expect(pull).toHaveBeenCalledOnce()) // sync immédiat, sans attendre un changement réseau
    expect(listener).toBeDefined() // toujours abonné pour les changements futurs
  })
})

describe('SyncEngine.pull', () => {
  function entry(sequenceId: number, eventType: string): ChangeLogEntry {
    return { sequenceId, sourceModule: 'sale', eventType, entityId: null, payload: '{}', occurredAt: 'now' }
  }

  it('applies entries via the registered handler and advances the cursor', async () => {
    const applied: ChangeLogEntry[] = []
    const pull = vi.fn().mockResolvedValue({
      entries: [entry(1, 'SaleCompletedEvent'), entry(2, 'SaleCompletedEvent')],
      nextCursor: 2,
      hasMore: false,
    } satisfies PullResponse)
    const { engine, storage } = engineWith({ push: vi.fn(), pull })
    engine.registerChangeHandler('SaleCompletedEvent', async (e) => {
      applied.push(e)
    })

    const result = await engine.pull()

    expect(result).toEqual({ applied: 2, nextCursor: 2 })
    expect(applied).toHaveLength(2)
    expect(await storage.getCursor()).toBe(2)
  })

  it('silently skips entries with no registered handler', async () => {
    const pull = vi.fn().mockResolvedValue({
      entries: [entry(1, 'UnknownFutureEvent')],
      nextCursor: 1,
      hasMore: false,
    } satisfies PullResponse)
    const { engine, storage } = engineWith({ push: vi.fn(), pull })

    const result = await engine.pull()

    expect(result.applied).toBe(1) // "applied" = traversé, pas forcément interprété
    expect(await storage.getCursor()).toBe(1)
  })

  it('pages through hasMore, advancing the cursor once per page', async () => {
    const pull = vi
      .fn()
      .mockResolvedValueOnce({ entries: [entry(1, 'X')], nextCursor: 1, hasMore: true })
      .mockResolvedValueOnce({ entries: [entry(2, 'X')], nextCursor: 2, hasMore: false })
    const { engine, storage } = engineWith({ push: vi.fn(), pull })
    engine.registerChangeHandler('X', () => {})

    const result = await engine.pull()

    expect(pull).toHaveBeenCalledTimes(2)
    expect(pull).toHaveBeenNthCalledWith(1, 0, 500)
    expect(pull).toHaveBeenNthCalledWith(2, 1, 500)
    expect(result.nextCursor).toBe(2)
    expect(await storage.getCursor()).toBe(2)
  })

  it('does not advance the cursor when a handler throws mid-page', async () => {
    const pull = vi.fn().mockResolvedValue({ entries: [entry(1, 'X'), entry(2, 'X')], nextCursor: 2, hasMore: false })
    const { engine, storage } = engineWith({ push: vi.fn(), pull })
    engine.registerChangeHandler('X', (e) => {
      if (e.sequenceId === 2) throw new Error('local apply failed')
    })

    await expect(engine.pull()).rejects.toThrow('local apply failed')
    expect(await storage.getCursor()).toBe(0)
  })
})
