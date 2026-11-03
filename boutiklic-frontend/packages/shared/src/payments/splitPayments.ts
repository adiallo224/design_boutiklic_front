/** Montants saisis par moyen de paiement (clé = identifiant du moyen, ex. 'CASH', 'MOBILE_MONEY_WAVE'). */
export type PaymentAmounts = Partial<Record<string, number>>

const CASH = 'CASH'

/** Paiement mixte impliquant l'espèce : elle absorbe automatiquement le reste plutôt que d'être
 *  ressaisie à la main (cf. étude "Encaisser" — taper 20 sur Wave sur un total de 150 doit remettre
 *  l'espèce à 130 sans action du caissier). En dehors de ce cas (CASH seul, ou CASH absent), les
 *  montants restent tels que saisis. */
function isMixedWithCash(amounts: PaymentAmounts): boolean {
  const keys = Object.keys(amounts)
  return keys.includes(CASH) && keys.length > 1
}

/** Vue résolue des montants à utiliser pour l'affichage, la validation et l'envoi au serveur : en
 *  paiement mixte, CASH = max(0, total net − somme des autres moyens actifs). */
export function resolveAmounts(amounts: PaymentAmounts, netTotal: number): PaymentAmounts {
  if (!isMixedWithCash(amounts)) return amounts
  const othersSum = Object.entries(amounts)
    .filter(([id]) => id !== CASH)
    .reduce((sum, [, value]) => sum + (value ?? 0), 0)
  return { ...amounts, [CASH]: Math.max(0, netTotal - othersSum) }
}

/** Coche/décoche un moyen de paiement.
 *  - Retrait : supprime simplement la clé (CASH, s'il reste actif, se recalcule via resolveAmounts).
 *  - Ajout alors que CASH est déjà actif : démarre à 0 — le caissier tape son montant et l'espèce suit.
 *  - Ajout sinon (comportement historique, paiement sans espèce) : préremplit avec le reste non alloué. */
export function toggleMethod(amounts: PaymentAmounts, id: string, netTotal: number): PaymentAmounts {
  if (amounts[id] !== undefined) {
    const next = { ...amounts }
    delete next[id]
    return next
  }
  if (amounts[CASH] !== undefined) {
    return { ...amounts, [id]: 0 }
  }
  const othersSum = Object.values(amounts).reduce((sum: number, value) => sum + (value ?? 0), 0)
  return { ...amounts, [id]: Math.max(0, netTotal - othersSum) }
}
