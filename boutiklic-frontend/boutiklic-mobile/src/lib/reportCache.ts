import AsyncStorage from '@react-native-async-storage/async-storage'
import type { DashboardResponse } from './reportingApi'

/**
 * Instantané du tableau de bord, lecture seule, horodaté — cf. plan offline-first, Phase 8 :
 * "rapports = dernier instantané connu, pas de recalcul en direct hors ligne, le calcul reste côté
 * serveur". Même pattern que lib/stockCache.ts : pas de réplique incrémentale (WatermelonDB), un
 * simple instantané re-fetché à chaque passage en ligne.
 */

const DASHBOARD_CACHE_KEY = 'boutiklic_dashboard_cache'
const DASHBOARD_CACHE_AT_KEY = 'boutiklic_dashboard_cache_at'

export async function cacheDashboard(data: DashboardResponse): Promise<void> {
  await AsyncStorage.multiSet([
    [DASHBOARD_CACHE_KEY, JSON.stringify(data)],
    [DASHBOARD_CACHE_AT_KEY, new Date().toISOString()],
  ])
}

export async function getCachedDashboard(): Promise<{ data: DashboardResponse | null; asOf: string | null }> {
  const [[, raw], [, asOf]] = await AsyncStorage.multiGet([DASHBOARD_CACHE_KEY, DASHBOARD_CACHE_AT_KEY])
  let data: DashboardResponse | null = null
  try {
    data = raw ? (JSON.parse(raw) as DashboardResponse) : null
  } catch {
    data = null
  }
  return { data, asOf }
}
