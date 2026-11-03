import type {
  ChangeHandler,
  ChangeLogEntry,
  QueuedOperation,
  SyncConflictHandler,
  SyncErrorClassifier,
  SyncStorage,
  SyncTransport,
  NetworkMonitor,
} from './types'

export interface SyncEngineConfig {
  storage: SyncStorage
  transport: SyncTransport
  network: NetworkMonitor
  errorClassifier: SyncErrorClassifier
  generateOperationId: () => string
  onConflict?: SyncConflictHandler
  onOperationSynced?: (operation: QueuedOperation) => void | Promise<void>
  pullPageSize?: number
}

const DEFAULT_PULL_PAGE_SIZE = 500

export class SyncEngine {
  private readonly storage: SyncStorage
  private readonly transport: SyncTransport
  private readonly network: NetworkMonitor
  private readonly errorClassifier: SyncErrorClassifier
  private readonly generateOperationId: () => string
  private readonly onConflict?: SyncConflictHandler
  private readonly onOperationSynced?: (operation: QueuedOperation) => void | Promise<void>
  private readonly pullPageSize: number
  private readonly changeHandlers = new Map<string, ChangeHandler>()

  private syncing = false

  private readonly outboxListeners = new Set<() => void>()

  constructor(config: SyncEngineConfig) {
    this.storage = config.storage
    this.transport = config.transport
    this.network = config.network
    this.errorClassifier = config.errorClassifier
    this.generateOperationId = config.generateOperationId
    this.onConflict = config.onConflict
    this.onOperationSynced = config.onOperationSynced
    this.pullPageSize = config.pullPageSize ?? DEFAULT_PULL_PAGE_SIZE
  }

  registerChangeHandler(eventType: string, handler: ChangeHandler): void {
    this.changeHandlers.set(eventType, handler)
  }

  subscribeOutboxChanges(listener: () => void): () => void {
    this.outboxListeners.add(listener)
    return () => this.outboxListeners.delete(listener)
  }

  async enqueue(type: string, payload: string): Promise<QueuedOperation> {
    const operation: QueuedOperation = {
      operationId: this.generateOperationId(),
      type,
      payload,
      createdAt: new Date().toISOString(),
      status: 'PENDING',
    }
    const queue = await this.storage.getOutbox()
    queue.push(operation)
    await this.storage.setOutbox(queue)
    this.notifyOutboxChanged()
    return operation
  }

  async processOutbox(): Promise<{ synced: number; failed: number }> {
    if (this.syncing) return { synced: 0, failed: 0 }
    this.syncing = true
    try {
      let synced = 0
      let failed = 0
      const queue = await this.storage.getOutbox()

      for (const operation of queue) {
        if (operation.status === 'FAILED') continue

        try {
          await this.transport.push(operation)
          await this.removeFromOutbox(operation.operationId)
          synced++
          await this.onOperationSynced?.(operation)
        } catch (error) {
          const kind = this.errorClassifier.classify(error)

          if (kind === 'network') {
            break
          }

          if (kind === 'conflict' && this.onConflict) {
            await this.onConflict(operation, error)
          }

          failed++
          await this.markFailed(operation.operationId, this.errorClassifier.describe(error))
        }
      }

      return { synced, failed }
    } finally {
      this.syncing = false
    }
  }

  async retryOperation(operationId: string): Promise<void> {
    const queue = await this.storage.getOutbox()
    const next = queue.map((op) => (op.operationId === operationId ? { ...op, status: 'PENDING' as const, lastError: undefined } : op))
    await this.storage.setOutbox(next)
    this.notifyOutboxChanged()
  }

  async discardOperation(operationId: string): Promise<void> {
    await this.removeFromOutbox(operationId)
  }

  getOutbox(): Promise<QueuedOperation[]> {
    return this.storage.getOutbox()
  }

  async pull(): Promise<{ applied: number; nextCursor: number }> {
    let applied = 0
    let cursor = await this.storage.getCursor()
    let hasMore = true

    while (hasMore) {
      const response = await this.transport.pull(cursor, this.pullPageSize)

      for (const entry of response.entries) {
        await this.applyChange(entry)
        applied++
      }

      cursor = response.nextCursor
      await this.storage.setCursor(cursor)
      hasMore = response.hasMore
    }

    return { applied, nextCursor: cursor }
  }

  async sync(): Promise<void> {
    await this.processOutbox()
    await this.pull()
  }

  startAutoSync(): () => void {
    void this.network.isOnline().then((online) => {
      if (online) void this.sync()
    })
    return this.network.subscribe((online) => {
      if (online) {
        void this.sync()
      }
    })
  }

  private async applyChange(entry: ChangeLogEntry): Promise<void> {
    const handler = this.changeHandlers.get(entry.eventType)
    if (handler) {
      await handler(entry)
    }
  }

  private async removeFromOutbox(operationId: string): Promise<void> {
    const queue = await this.storage.getOutbox()
    await this.storage.setOutbox(queue.filter((op) => op.operationId !== operationId))
    this.notifyOutboxChanged()
  }

  private async markFailed(operationId: string, lastError: string): Promise<void> {
    const queue = await this.storage.getOutbox()
    const next = queue.map((op) => (op.operationId === operationId ? { ...op, status: 'FAILED' as const, lastError } : op))
    await this.storage.setOutbox(next)
    this.notifyOutboxChanged()
  }

  private notifyOutboxChanged(): void {
    this.outboxListeners.forEach((listener) => listener())
  }
}
