import AsyncStorage from '@react-native-async-storage/async-storage'

/**
 * Brouillon local d'un inventaire physique : les quantités saisies sur l'appareil qui n'ont pas pu être envoyées (coupure réseau,
 * app fermée en cours de comptage). Une valeur {@code null} veut dire « retirer le comptage de cet article ». Les saisies sont
 * rejouées dans l'ordre où elles ont été faites (la dernière saisie d'un article remplace la précédente) ; le serveur reste seul
 * autoritaire sur le stock — le brouillon ne contient jamais que ce que le compteur a tapé.
 *
 * Étude study/etude_inventaire_physique.md, phase 4. La saisie hors ligne complète par l'Operation Outbox (idempotente, rejouée
 * automatiquement) est la phase 5 ; ici l'envoi est déclenché par le compteur ou à la réouverture de l'écran.
 */

export type PendingCounts = Record<string, number | null>

const keyOf = (countId: string) => `boutiklic_stock_count_draft_${countId}`

export async function loadPendingCounts(countId: string): Promise<PendingCounts> {
  try {
    const raw = await AsyncStorage.getItem(keyOf(countId))
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const result: PendingCounts = {}
    for (const [productId, value] of Object.entries(parsed)) {
      if (value === null || (typeof value === 'number' && Number.isInteger(value) && value >= 0)) result[productId] = value
    }
    return result
  } catch {
    return {}
  }
}

async function save(countId: string, pending: PendingCounts): Promise<void> {
  if (Object.keys(pending).length === 0) {
    await AsyncStorage.removeItem(keyOf(countId))
    return
  }
  await AsyncStorage.setItem(keyOf(countId), JSON.stringify(pending))
}

/** Retient une saisie non envoyée ; renvoie le brouillon à jour. */
export async function setPendingCount(countId: string, productId: string, value: number | null): Promise<PendingCounts> {
  const pending = { ...(await loadPendingCounts(countId)), [productId]: value }
  await save(countId, pending)
  return pending
}

/** Retire les saisies envoyées avec succès ; renvoie le brouillon restant. */
export async function removePendingCounts(countId: string, productIds: string[]): Promise<PendingCounts> {
  const pending = await loadPendingCounts(countId)
  for (const productId of productIds) delete pending[productId]
  await save(countId, pending)
  return pending
}

/**
 * Retire du brouillon les saisies qui viennent d'être envoyées — mais seulement celles dont la valeur du brouillon est ENCORE celle envoyée :
 * si le compteur a retapé l'article entre-temps, la nouvelle saisie (encore dans la file) reste affichée « À envoyer ».
 */
export async function removePendingIfSame(countId: string, sent: { productId: string; quantity: number | null }[]): Promise<PendingCounts> {
  const pending = await loadPendingCounts(countId)
  for (const { productId, quantity } of sent) {
    if (productId in pending && pending[productId] === quantity) delete pending[productId]
  }
  await save(countId, pending)
  return pending
}

export async function clearPendingCounts(countId: string): Promise<void> {
  await AsyncStorage.removeItem(keyOf(countId))
}
