import type { PaymentMethod, PaymentSplit, SaleHistoryItemResponse } from './salesApi'

type SaleForPayments = Pick<SaleHistoryItemResponse, 'paymentMethod' | 'totalAmount' | 'payments'>

/** Tranches de règlement d'une vente de l'historique.
 *
 *  `paymentMethod` vaut MIXED dès qu'une vente est réglée en plusieurs tranches : il ne dit pas combien
 *  chaque mode a encaissé — c'est `payments` qui le dit (le serveur somme d'ailleurs par tranche pour ses
 *  propres totaux). Repli sur le montant total quand `payments` est absent ou vide (ancienne réponse,
 *  entrée hors ligne) : correct pour un mode unique, et rien à attribuer à une vente MIXED sans détail. */
export function paymentPortions(sale: SaleForPayments): PaymentSplit[] {
  if (sale.payments && sale.payments.length > 0) return sale.payments
  if (sale.paymentMethod === 'MIXED') return []
  return [{ method: sale.paymentMethod as PaymentMethod, amount: sale.totalAmount }]
}

/** La vente a-t-elle au moins une tranche réglée avec ce mode (seule ou combinée à d'autres) ? */
export function hasPaymentMethod(sale: SaleForPayments, method: PaymentMethod): boolean {
  return paymentPortions(sale).some((p) => p.method === method)
}

/** Montant réellement encaissé avec ce mode sur l'ensemble de ces ventes, tranche par tranche. */
export function sumByMethod(sales: SaleForPayments[], method: PaymentMethod): number {
  return sales.reduce(
    (total, sale) => total + paymentPortions(sale).filter((p) => p.method === method).reduce((s, p) => s + p.amount, 0),
    0,
  )
}
