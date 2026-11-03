/**
 * Annulation du dialogue d'impression. Sur iOS, expo-print REJETTE la promesse quand l'utilisateur ferme le
 * dialogue sans imprimer (`PrintIncompleteException`, message « Printing did not complete » — lu dans le code
 * natif installé) ; sur Android la promesse se résout simplement à l'ouverture du dialogue. Annuler n'est pas
 * une erreur : on ne doit pas afficher « Impossible d'ouvrir l'impression ».
 */
export function isPrintCancelled(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const { code, message } = error as { code?: unknown; message?: unknown }
  if (code === 'ERR_PRINT_INCOMPLETE') return true
  return typeof message === 'string' && /printing did not complete|cancell?ed/i.test(message)
}
