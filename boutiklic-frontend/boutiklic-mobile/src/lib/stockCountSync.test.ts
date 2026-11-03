jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
jest.mock('./syncEngine', () => ({ syncEngine: { enqueue: jest.fn().mockResolvedValue({}), getOutbox: jest.fn().mockResolvedValue([]) } }))

import AsyncStorage from '@react-native-async-storage/async-storage'
import type { QueuedOperation } from '@boutiklic/shared'
import { enqueueCountEntry, queuedCountProductIds } from './stockCountSync'
import { onCountOperationSynced } from './stockCountSyncHooks'
import { loadPendingCounts, removePendingIfSame, setPendingCount } from './stockCountDraft'
import { syncEngine } from './syncEngine'

const engine = syncEngine as unknown as { enqueue: jest.Mock; getOutbox: jest.Mock }

function operation(type: string, payload: unknown, status: QueuedOperation['status'] = 'PENDING'): QueuedOperation {
  return { operationId: 'op', type, payload: typeof payload === 'string' ? payload : JSON.stringify(payload), createdAt: '2026-10-24T09:00:00.000Z', status }
}

const entry = (countId: string, ...lines: { productId: string; quantity: number | null }[]) =>
  operation('RECORD_STOCK_COUNT_LINES', { countId, lines: lines.map((l) => ({ ...l, countedAt: '2026-10-24T09:00:00.000Z' })) })

beforeEach(async () => {
  await AsyncStorage.clear()
  engine.enqueue.mockClear()
  engine.getOutbox.mockReset().mockResolvedValue([])
})

describe('enqueueCountEntry', () => {
  it('met la saisie en file avec l\'heure de la saisie, au format ISO', async () => {
    await enqueueCountEntry('c1', 'rice', 7, new Date('2026-10-24T09:30:00.000Z'))

    expect(engine.enqueue).toHaveBeenCalledWith(
      'RECORD_STOCK_COUNT_LINES',
      JSON.stringify({ countId: 'c1', lines: [{ productId: 'rice', quantity: 7, countedAt: '2026-10-24T09:30:00.000Z' }] }),
    )
  })

  it('une quantité null (retrait du comptage) est mise en file telle quelle', async () => {
    await enqueueCountEntry('c1', 'rice', null, new Date('2026-10-24T09:30:00.000Z'))

    const payload = JSON.parse(engine.enqueue.mock.calls[0][1])
    expect(payload.lines[0].quantity).toBeNull()
  })
})

describe('queuedCountProductIds', () => {
  it('liste les articles de CE comptage ayant une saisie en file, y compris une saisie en échec', async () => {
    engine.getOutbox.mockResolvedValue([
      entry('c1', { productId: 'rice', quantity: 7 }),
      operation('RECORD_STOCK_COUNT_LINES', { countId: 'c1', lines: [{ productId: 'oil', quantity: 2, countedAt: '2026-10-24T09:00:00.000Z' }] }, 'FAILED'),
      entry('autre-comptage', { productId: 'soap', quantity: 1 }),
      operation('ADJUST_STOCK', { productId: 'salt', delta: 1 }),
      operation('RECORD_STOCK_COUNT_LINES', 'pas du json'),
    ])

    expect([...(await queuedCountProductIds('c1'))].sort()).toEqual(['oil', 'rice'])
  })

  it('est vide sans file', async () => {
    expect((await queuedCountProductIds('c1')).size).toBe(0)
  })
})

describe('onCountOperationSynced (fin de synchronisation d\'une saisie)', () => {
  it('retire du brouillon la saisie qui vient de partir', async () => {
    await setPendingCount('c1', 'rice', 7)
    await setPendingCount('c1', 'oil', 4)

    await onCountOperationSynced(entry('c1', { productId: 'rice', quantity: 7 }))

    expect(await loadPendingCounts('c1')).toEqual({ oil: 4 })
  })

  it('garde la saisie plus récente si le compteur a retapé l\'article entre-temps', async () => {
    await setPendingCount('c1', 'rice', 9)                                   // retapé : 9, encore dans la file

    await onCountOperationSynced(entry('c1', { productId: 'rice', quantity: 7 }))   // la première saisie (7) vient de partir

    expect(await loadPendingCounts('c1')).toEqual({ rice: 9 })
  })

  it('un retrait (null) synchronisé sort du brouillon lui aussi', async () => {
    await setPendingCount('c1', 'rice', null)

    await onCountOperationSynced(entry('c1', { productId: 'rice', quantity: null }))

    expect(await loadPendingCounts('c1')).toEqual({})
  })

  it('ignore les autres types d\'opération et les contenus illisibles', async () => {
    await setPendingCount('c1', 'rice', 7)

    await onCountOperationSynced(operation('ADJUST_STOCK', { productId: 'rice', delta: 1 }))
    await onCountOperationSynced(operation('RECORD_STOCK_COUNT_LINES', 'pas du json'))

    expect(await loadPendingCounts('c1')).toEqual({ rice: 7 })
  })
})

describe('removePendingIfSame', () => {
  it('ne retire que les valeurs identiques à celles envoyées', async () => {
    await setPendingCount('c1', 'rice', 7)
    await setPendingCount('c1', 'oil', 4)

    const remaining = await removePendingIfSame('c1', [{ productId: 'rice', quantity: 7 }, { productId: 'oil', quantity: 5 }])

    expect(remaining).toEqual({ oil: 4 })
  })
})
