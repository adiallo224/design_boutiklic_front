import type { NetworkMonitor } from '@boutiklic/shared'
import { API_BASE, fetchWithTimeout } from './apiClient'

/** navigator.onLine seul ne dit que "une interface réseau existe" — un wifi sans internet reste
 *  "online" alors qu'aucune requête n'aboutira (cf. plan offline-first, Phase 0/2 : détection de
 *  connectivité réelle). On sonde /identity/.well-known/jwks.json : public (pas d'auth requise),
 *  bon marché (pas de requête DB), et déjà appelé en trafic réel par la gateway elle-même pour
 *  valider les JWT — donc garanti de traverser le même chemin réseau que le reste de l'app, sans
 *  inventer un endpoint de health check séparé dont le déploiement de prod devrait se souvenir. */
const PROBE_PATH = '/identity/.well-known/jwks.json'
const PROBE_TIMEOUT_MS = 4000

async function probe(): Promise<boolean> {
  if (!navigator.onLine) return false
  try {
    const response = await fetchWithTimeout(`${API_BASE}${PROBE_PATH}`, { method: 'GET' }, PROBE_TIMEOUT_MS)
    return response.ok
  } catch {
    return false
  }
}

export const networkMonitor: NetworkMonitor = {
  isOnline: probe,
  subscribe(listener) {
    // navigator.onLine change déclenche une nouvelle sonde plutôt que d'être pris pour argent
    // comptant — 'online' signifie juste qu'une interface est remontée, pas qu'internet marche.
    const handleChange = () => {
      void probe().then(listener)
    }
    window.addEventListener('online', handleChange)
    window.addEventListener('offline', handleChange)
    return () => {
      window.removeEventListener('online', handleChange)
      window.removeEventListener('offline', handleChange)
    }
  },
}
