import type { FulfillmentStatus, OrderAction, OrderDetail, OrderStatus, PaymentStatus } from './onlineOrdersApi'

/**
 * Quelles actions proposer sur une commande. Cette logique REFLÈTE la machine à états du serveur (agrégat OnlineOrder) pour n'afficher que ce qui peut réussir; le serveur reste
 * l'unique juge et refuse (409) tout ce qui serait interdit. Un bouton qui n'apparaît pas évite une erreur au vendeur, il ne remplace jamais le contrôle serveur.
 */
type State = Pick<OrderDetail, 'status' | 'paymentStatus' | 'fulfillmentStatus' | 'stockStatus' | 'deliveryMethod'>

const OPEN_PAYMENT: PaymentStatus[] = ['UNPAID', 'PENDING', 'FAILED']
const CLOSABLE_PAYMENT: PaymentStatus[] = ['PAID', 'UNPAID', 'FAILED']
const HANDED_OVER: FulfillmentStatus[] = ['DELIVERED', 'PICKED_UP']
const FINAL: OrderStatus[] = ['COMPLETED', 'CANCELLED', 'EXPIRED']

export function availableActions(o: State): OrderAction[] {
  const actions: OrderAction[] = []
  const confirmed = o.status === 'CONFIRMED'
  const delivery = o.deliveryMethod === 'DELIVERY'

  if (o.status === 'PLACED') actions.push('confirm')
  if (confirmed && o.fulfillmentStatus === 'UNFULFILLED') actions.push('prepare')
  if (confirmed && !delivery && o.fulfillmentStatus === 'PREPARING') actions.push('ready')
  if (confirmed && delivery && o.fulfillmentStatus === 'PREPARING' && o.stockStatus === 'RESERVED') actions.push('ship')
  if (confirmed && !delivery && o.fulfillmentStatus === 'READY_FOR_PICKUP' && o.stockStatus === 'RESERVED') actions.push('hand-over')
  if (confirmed && delivery && o.fulfillmentStatus === 'OUT_FOR_DELIVERY') actions.push('deliver', 'fail-delivery')
  if (!FINAL.includes(o.status) && OPEN_PAYMENT.includes(o.paymentStatus)) actions.push('mark-paid')
  if (confirmed && o.stockStatus === 'CONSUMED' && HANDED_OVER.includes(o.fulfillmentStatus) && CLOSABLE_PAYMENT.includes(o.paymentStatus)) actions.push('complete')
  if ((o.status === 'PLACED' || confirmed) && o.stockStatus !== 'CONSUMED') actions.push('cancel')
  return actions
}

/** L'étape qui fait avancer la commande (mise en avant), s'il y en a une. Jamais « annuler » ni « encaisser ». */
const FORWARD: OrderAction[] = ['complete', 'hand-over', 'deliver', 'ship', 'ready', 'prepare', 'confirm']
export function nextStep(actions: OrderAction[]): OrderAction | null {
  return FORWARD.find((a) => actions.includes(a)) ?? null
}

/** Actions qui demandent un motif (obligatoire ou non). */
export const ACTIONS_WITH_REASON: Partial<Record<OrderAction, 'required' | 'optional'>> = {
  cancel: 'optional',
  'fail-delivery': 'optional',
  'mark-paid': 'optional',
}

/** Actions qui engagent le stock ou la comptabilité: confirmation explicite avant d'agir. */
export const ACTIONS_NEEDING_CONFIRMATION: OrderAction[] = ['ship', 'hand-over', 'complete', 'cancel', 'fail-delivery']

/** Une commande livrée et clôturée alors qu'elle n'est pas payée part en DETTE au nom de l'acheteur: à dire clairement avant. */
export function completeWillCreateDebt(o: Pick<OrderDetail, 'paymentStatus'>): boolean {
  return o.paymentStatus !== 'PAID'
}

/** Une étape de statut a-t-elle une couleur d'alerte ? Sert aux pastilles (rouge = à traiter / à regarder). */
export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'bad'

export function orderTone(status: OrderStatus): Tone {
  return status === 'PLACED' ? 'warn' : status === 'CONFIRMED' ? 'info' : status === 'COMPLETED' ? 'ok' : 'bad'
}

export function paymentTone(status: PaymentStatus): Tone {
  switch (status) {
    case 'PAID':
      return 'ok'
    case 'UNPAID':
      return 'neutral'
    case 'PENDING':
      return 'info'
    case 'FAILED':
    case 'REFUND_PENDING':
      return 'bad'
    default:
      return 'neutral'
  }
}

export function fulfillmentTone(status: FulfillmentStatus): Tone {
  switch (status) {
    case 'DELIVERED':
    case 'PICKED_UP':
      return 'ok'
    case 'PREPARING':
    case 'READY_FOR_PICKUP':
    case 'OUT_FOR_DELIVERY':
      return 'info'
    case 'DELIVERY_FAILED':
    case 'RETURNED':
      return 'bad'
    default:
      return 'neutral'
  }
}

/** Score de risque en trois niveaux lisibles. */
export function riskLevel(score: number): 'none' | 'medium' | 'high' {
  return score >= 75 ? 'high' : score >= 25 ? 'medium' : 'none'
}

/** Numéro pour un lien WhatsApp (chiffres seuls), ou null s'il n'y en a pas assez. */
export function whatsappDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 8 ? digits : null
}
