import { describe, expect, it } from 'vitest'
import {
  STOCK_COUNT_SYNC_OPERATION,
  buildStockCountSyncPayload,
  countGap,
  filterStockCountLines,
  isOpenStockCount,
  parseCountedInput,
  parseStockCountSyncPayload,
  stockCountGapValue,
  stockCountNetGapValue,
  stockCountProgressPercent,
  summarizeStockCount,
} from '@boutiklic/shared'

const lines = [
  { productId: 'rice', systemQty: 10, countedQty: 7 },    // -3
  { productId: 'oil', systemQty: 4, countedQty: 4 },      // 0
  { productId: 'soap', systemQty: 6, countedQty: 9 },     // +3
  { productId: 'salt', systemQty: 5, countedQty: null },  // non compté
]

describe('countGap', () => {
  it('is counted minus system, and null while either is missing', () => {
    expect(countGap({ systemQty: 10, countedQty: 7 })).toBe(-3)
    expect(countGap({ systemQty: 4, countedQty: 4 })).toBe(0)
    expect(countGap({ systemQty: 5, countedQty: null })).toBeNull()
    expect(countGap({ systemQty: null, countedQty: 5 })).toBeNull()   // comptage aveugle : le compteur ne voit pas le stock
  })
})

describe('summarizeStockCount', () => {
  it('counts counted/uncounted lines and splits the gaps in surplus and shortage units', () => {
    expect(summarizeStockCount(lines)).toEqual({ total: 4, counted: 3, uncounted: 1, withGap: 2, surplusUnits: 3, shortageUnits: 3 })
  })

  it('handles an empty count', () => {
    const summary = summarizeStockCount([])
    expect(summary.total).toBe(0)
    expect(stockCountProgressPercent(summary)).toBe(0)
  })

  it('computes a rounded progress percentage', () => {
    expect(stockCountProgressPercent({ total: 3, counted: 1 })).toBe(33)
    expect(stockCountProgressPercent({ total: 4, counted: 4 })).toBe(100)
  })
})

describe('filterStockCountLines', () => {
  it('keeps every line, only the uncounted, only the counted, or only the gaps', () => {
    expect(filterStockCountLines(lines, 'all')).toHaveLength(4)
    expect(filterStockCountLines(lines, 'uncounted').map((l) => l.productId)).toEqual(['salt'])
    expect(filterStockCountLines(lines, 'counted').map((l) => l.productId)).toEqual(['rice', 'oil', 'soap'])
    expect(filterStockCountLines(lines, 'gaps').map((l) => l.productId)).toEqual(['rice', 'soap'])
  })

  it('never returns the input array itself', () => {
    expect(filterStockCountLines(lines, 'all')).not.toBe(lines)
  })
})

describe('gap value', () => {
  it('multiplies the gap by the unit cost', () => {
    expect(stockCountGapValue(-3, 300)).toBe(-900)
  })

  it('sums the value of the gaps whose cost is known and ignores uncounted lines', () => {
    const costs: Record<string, number> = { rice: 300, soap: 100 }
    expect(stockCountNetGapValue(lines, (id) => costs[id])).toBe(-3 * 300 + 3 * 100)
    expect(stockCountNetGapValue(lines, () => undefined)).toBe(0)
  })
})

describe('parseCountedInput', () => {
  it('treats an empty entry as not counted', () => {
    expect(parseCountedInput('')).toBe('empty')
    expect(parseCountedInput('   ')).toBe('empty')
  })

  it('accepts whole non-negative numbers, including zero and spreadsheet-style decimals', () => {
    expect(parseCountedInput('0')).toBe(0)
    expect(parseCountedInput('12')).toBe(12)
    expect(parseCountedInput('7,0')).toBe(7)
    expect(parseCountedInput('1 200')).toBe(1200)
  })

  it('rejects negatives, fractions and text', () => {
    expect(parseCountedInput('-1')).toBeNull()
    expect(parseCountedInput('2,5')).toBeNull()
    expect(parseCountedInput('abc')).toBeNull()
    expect(parseCountedInput('99999999999999999999')).toBeNull()
  })
})

describe('isOpenStockCount', () => {
  it('is true only while counting or in review', () => {
    expect(isOpenStockCount('COUNTING')).toBe(true)
    expect(isOpenStockCount('PENDING_REVIEW')).toBe(true)
    expect(isOpenStockCount('VALIDATED')).toBe(false)
    expect(isOpenStockCount('CANCELLED')).toBe(false)
  })
})

describe('stock count sync payload', () => {
  it('uses the operation type the server handler is registered for', () => {
    expect(STOCK_COUNT_SYNC_OPERATION).toBe('RECORD_STOCK_COUNT_LINES')
  })

  it('round-trips the entries, a null quantity meaning "remove the count"', () => {
    const lines = [
      { productId: 'rice', quantity: 7, countedAt: '2026-10-24T09:30:00.000Z' },
      { productId: 'oil', quantity: null, countedAt: '2026-10-24T09:31:00.000Z' },
      { productId: 'soap', quantity: 0, countedAt: '2026-10-24T09:32:00.000Z' },
    ]

    expect(parseStockCountSyncPayload(buildStockCountSyncPayload('c1', lines))).toEqual({ countId: 'c1', lines })
  })

  it('returns null for anything that is not a well-formed payload instead of throwing', () => {
    expect(parseStockCountSyncPayload('pas du json')).toBeNull()
    expect(parseStockCountSyncPayload('null')).toBeNull()
    expect(parseStockCountSyncPayload('{"countId":"c1"}')).toBeNull()
    expect(parseStockCountSyncPayload('{"countId":1,"lines":[]}')).toBeNull()
    expect(parseStockCountSyncPayload('{"countId":"c1","lines":[{"productId":"rice","quantity":-1,"countedAt":"x"}]}')).toBeNull()
    expect(parseStockCountSyncPayload('{"countId":"c1","lines":[{"productId":"rice","quantity":2.5,"countedAt":"x"}]}')).toBeNull()
    expect(parseStockCountSyncPayload('{"countId":"c1","lines":[{"productId":"rice","quantity":1}]}')).toBeNull()
  })
})
