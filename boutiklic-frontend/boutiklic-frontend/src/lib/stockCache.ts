import type { StockLineResponse } from './inventoryApi'

/**
 * Instantané du stock, lecture seule, horodaté — cf. plan offline-first, règle non-négociable :
 * "le serveur reste seul autoritaire pour la décrémentation réelle ; le stock local n'est qu'une
 * estimation affichée avec horodatage de dernière synchro". Miroir de
 * boutiklic-mobile/src/lib/stockCache.ts (localStorage plutôt qu'AsyncStorage, synchrone comme le
 * reste des libs web — cf. session.ts, outbox.ts).
 */

const STOCK_CACHE_KEY = 'boutiklic_stock_cache'
const STOCK_CACHE_AT_KEY = 'boutiklic_stock_cache_at'

export function cacheStock(lines: StockLineResponse[]): void {
  localStorage.setItem(STOCK_CACHE_KEY, JSON.stringify(lines))
  localStorage.setItem(STOCK_CACHE_AT_KEY, new Date().toISOString())
}

export function getCachedStock(): { lines: StockLineResponse[]; asOf: string | null } {
  const raw = localStorage.getItem(STOCK_CACHE_KEY)
  let lines: StockLineResponse[] = []
  try {
    lines = raw ? (JSON.parse(raw) as StockLineResponse[]) : []
  } catch {
    lines = []
  }
  return { lines, asOf: localStorage.getItem(STOCK_CACHE_AT_KEY) }
}
