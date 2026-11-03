import type { DashboardResponse } from './reportingApi'

/**
 * Instantané du tableau de bord, lecture seule, horodaté — cf. plan offline-first, Phase 8 :
 * "rapports = dernier instantané connu, pas de recalcul en direct hors ligne, le calcul reste côté
 * serveur". Même pattern que lib/stockCache.ts : pas de réplique incrémentale (Dexie), un simple
 * instantané re-fetché à chaque passage en ligne.
 */

const DASHBOARD_CACHE_KEY = 'boutiklic_dashboard_cache'
const DASHBOARD_CACHE_AT_KEY = 'boutiklic_dashboard_cache_at'

export function cacheDashboard(data: DashboardResponse): void {
  localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(data))
  localStorage.setItem(DASHBOARD_CACHE_AT_KEY, new Date().toISOString())
}

export function getCachedDashboard(): { data: DashboardResponse | null; asOf: string | null } {
  const raw = localStorage.getItem(DASHBOARD_CACHE_KEY)
  let data: DashboardResponse | null = null
  try {
    data = raw ? (JSON.parse(raw) as DashboardResponse) : null
  } catch {
    data = null
  }
  return { data, asOf: localStorage.getItem(DASHBOARD_CACHE_AT_KEY) }
}
