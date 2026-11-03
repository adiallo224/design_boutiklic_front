import NetInfo, { type NetInfoState } from '@react-native-community/netinfo'
import type { NetworkMonitor } from '@boutiklic/shared'

/** isConnected seul ne dit que "associé au wifi/à l'antenne" — un portail captif ou un wifi sans
 *  internet reste "connecté" alors qu'aucune requête n'aboutira. isInternetReachable est le résultat
 *  d'une sonde réelle faite par NetInfo ; null tant qu'elle n'a pas encore répondu, donc on ne
 *  considère "hors ligne" que sur un false explicite, jamais pendant la détection (cf. plan
 *  offline-first, Phase 0/2 : détection de connectivité réelle, pas seulement isConnected). */
function isReallyOnline(state: Pick<NetInfoState, 'isConnected' | 'isInternetReachable'>): boolean {
  return !!state.isConnected && state.isInternetReachable !== false
}

/** Implémentation NetInfo du contrat NetworkMonitor partagé (cf. @boutiklic/shared/sync) — source
 *  unique de vérité sur la connectivité pour ce device, consommée par OfflineBanner, useOutbox et
 *  le SyncEngine plutôt que chacun ré-interrogeant NetInfo à sa façon. */
export const networkMonitor: NetworkMonitor = {
  async isOnline() {
    const state = await NetInfo.fetch()
    return isReallyOnline(state)
  },
  subscribe(listener) {
    return NetInfo.addEventListener((state) => listener(isReallyOnline(state)))
  },
}
