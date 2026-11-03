
export interface SyncOperation {
  operationId: string
  type: string
  payload: string
}

export interface PushResponse {
  resultPayload: string
}

export interface ChangeLogEntry {
  sequenceId: number
  sourceModule: string
  eventType: string
  entityId: string | null
  payload: string
  occurredAt: string
}

export interface PullResponse {
  entries: ChangeLogEntry[]
  nextCursor: number
  hasMore: boolean
}

export interface QueuedOperation extends SyncOperation {
  createdAt: string
  status: 'PENDING' | 'FAILED'
  lastError?: string
}

export interface SyncTransport {
  push(operation: SyncOperation): Promise<PushResponse>
  pull(cursor: number, limit?: number): Promise<PullResponse>
}

export interface SyncStorage {
  getCursor(): Promise<number>
  setCursor(cursor: number): Promise<void>
  getOutbox(): Promise<QueuedOperation[]>
  setOutbox(queue: QueuedOperation[]): Promise<void>
}

export interface NetworkMonitor {
  isOnline(): Promise<boolean>
  subscribe(listener: (online: boolean) => void): () => void
}

export type ChangeHandler = (entry: ChangeLogEntry) => void | Promise<void>

export type SyncErrorKind = 'network' | 'rejected' | 'conflict'

export interface SyncErrorClassifier {
  classify(error: unknown): SyncErrorKind
  describe(error: unknown): string
}

export type SyncConflictHandler = (operation: QueuedOperation, error: unknown) => void | Promise<void>
