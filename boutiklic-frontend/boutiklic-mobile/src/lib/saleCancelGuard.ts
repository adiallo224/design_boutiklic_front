import { ApiError } from './apiClient'
import { salesApi } from './salesApi'
import { debtApi } from './debtApi'

/** Vrai si la vente a une dette liée qui a déjà reçu un paiement (ou une réduction suite à un retour).
 *
 *  Annuler alors la vente laisserait la dette active côté serveur (le module debt ne peut pas la
 *  refuser : cycle de modules) et le client redevable d'une vente annulée — l'annulation doit donc
 *  être refusée ici, et le propriétaire passer par un retour avec avoir depuis l'Historique.
 *  Jointure côté client (vente -> Sale.debtId -> dette), pas de couplage serveur.
 *
 *  Toute erreur réseau/serveur remonte à l'appelant (on n'annule pas à l'aveugle). Exception : le
 *  module debt répond 422 quand la dette n'existe plus (supprimée après avoir été soldée) — rien
 *  à protéger dans ce cas. */
export async function hasPaidDebtPortion(saleId: string): Promise<boolean> {
  const sale = await salesApi.getById(saleId)
  if (!sale.debtId) return false
  try {
    const debt = await debtApi.getDebtById(sale.debtId)
    return debt.amountPaid > 0
  } catch (e) {
    if (e instanceof ApiError && e.status === 422) return false
    throw e
  }
}
