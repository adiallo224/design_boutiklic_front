import AsyncStorage from '@react-native-async-storage/async-storage'
import type { StockLineResponse } from './inventoryApi'

/**
 * Instantané du stock, lecture seule, horodaté — cf. plan offline-first, règle non-négociable :
 * "le serveur reste seul autoritaire pour la décrémentation réelle ; le stock local n'est qu'une
 * estimation affichée avec horodatage de dernière synchro". Contrairement au catalogue (WatermelonDB,
 * réplique incrémentale via change_log), le stock n'a pas besoin de granularité : un instantané complet
 * re-fetché à chaque passage en ligne suffit, jamais réécrit localement.
 */

const STOCK_CACHE_KEY = 'boutiklic_stock_cache'
const STOCK_CACHE_AT_KEY = 'boutiklic_stock_cache_at'

export async function cacheStock(lines: StockLineResponse[]): Promise<void> {
  await AsyncStorage.multiSet([
    [STOCK_CACHE_KEY, JSON.stringify(lines)],
    [STOCK_CACHE_AT_KEY, new Date().toISOString()],
  ])
}

export async function getCachedStock(): Promise<{ lines: StockLineResponse[]; asOf: string | null }> {
  const [[, rawLines], [, asOf]] = await AsyncStorage.multiGet([STOCK_CACHE_KEY, STOCK_CACHE_AT_KEY])
  let lines: StockLineResponse[] = []
  try {
    lines = rawLines ? (JSON.parse(rawLines) as StockLineResponse[]) : []
  } catch {
    lines = []
  }
  return { lines, asOf }
}
