import { describe, expect, it } from 'vitest'
import {
  INVENTORY_REPORTS,
  buildInventoryExportQuery,
  inventoryExportFileName,
  inventoryReportDef,
} from '@boutiklic/shared'

describe('buildInventoryExportQuery', () => {
  it('sends only type and format by default (all depots, all categories)', () => {
    expect(buildInventoryExportQuery({ type: 'general', format: 'xlsx' })).toBe('type=general&format=xlsx')
  })

  it('adds depot, category and prices for the general report', () => {
    const query = new URLSearchParams(
      buildInventoryExportQuery({ type: 'general', format: 'pdf', depotId: 'd1', categoryId: 'c1', includePrices: true }),
    )
    expect(query.get('depotId')).toBe('d1')
    expect(query.get('categoryId')).toBe('c1')
    expect(query.get('includePrices')).toBe('true')
  })

  it('does not leak filters the chosen report cannot read', () => {
    const query = new URLSearchParams(
      buildInventoryExportQuery({
        type: 'low_stock',
        format: 'csv',
        includePrices: true,
        from: '2026-10-01',
        to: '2026-10-31',
        movementType: 'SALE',
      }),
    )
    expect(query.has('includePrices')).toBe(false)
    expect(query.has('from')).toBe(false)
    expect(query.has('to')).toBe(false)
    expect(query.has('movementType')).toBe(false)
  })

  it('sends the period and operation only for movements', () => {
    const query = new URLSearchParams(
      buildInventoryExportQuery({ type: 'movements', format: 'xlsx', from: '2026-10-01', to: '2026-10-31', movementType: 'INTAKE', includePrices: true }),
    )
    expect(query.get('from')).toBe('2026-10-01')
    expect(query.get('to')).toBe('2026-10-31')
    expect(query.get('movementType')).toBe('INTAKE')
    expect(query.has('includePrices')).toBe(false)
  })

  it('treats empty and null filters as absent', () => {
    expect(buildInventoryExportQuery({ type: 'movements', format: 'csv', depotId: '', categoryId: null, from: '', movementType: null })).toBe(
      'type=movements&format=csv',
    )
  })
})

describe('inventory reports catalogue', () => {
  it('flags only the valuation as financial, and only the general report as price-capable', () => {
    expect(INVENTORY_REPORTS.filter((r) => r.financial).map((r) => r.type)).toEqual(['valuation'])
    expect(INVENTORY_REPORTS.filter((r) => r.supportsPrices).map((r) => r.type)).toEqual(['general'])
    expect(INVENTORY_REPORTS.filter((r) => r.supportsPeriod).map((r) => r.type)).toEqual(['movements'])
  })

  it('names files with a dash-separated type, the date and the format extension', () => {
    expect(inventoryExportFileName('low_stock', 'xlsx', '2026-10-24')).toBe('inventaire-low-stock-2026-10-24.xlsx')
    expect(inventoryReportDef('valuation').financial).toBe(true)
  })
})
