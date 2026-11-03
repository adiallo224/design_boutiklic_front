import { describe, expect, it } from 'vitest'
import {
  ACTIONS_NEEDING_CONFIRMATION,
  availableActions,
  completeWillCreateDebt,
  fulfillmentTone,
  nextStep,
  orderTone,
  paymentTone,
  riskLevel,
  whatsappDigits,
} from './onlineOrderActions'
import type { FulfillmentStatus, OrderStatus, PaymentStatus, StockStatus } from './onlineOrdersApi'

type S = Parameters<typeof availableActions>[0]
const state = (o: Partial<S> = {}): S => ({ status: 'PLACED', paymentStatus: 'UNPAID', fulfillmentStatus: 'UNFULFILLED', stockStatus: 'RESERVED', deliveryMethod: 'DELIVERY', ...o })

describe('availableActions — le parcours d\'une livraison', () => {
  it('reçue: confirmer, encaisser ou annuler (rien d\'autre)', () => {
    expect(availableActions(state())).toEqual(['confirm', 'mark-paid', 'cancel'])
  })

  it('confirmée: préparer', () => {
    expect(availableActions(state({ status: 'CONFIRMED' }))).toEqual(['prepare', 'mark-paid', 'cancel'])
  })

  it('en préparation: expédier (le stock sort ici)', () => {
    expect(availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'PREPARING' }))).toEqual(['ship', 'mark-paid', 'cancel'])
  })

  it('en route: livrer ou signaler un échec, et plus d\'annulation (le stock est sorti)', () => {
    const a = availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'OUT_FOR_DELIVERY', stockStatus: 'CONSUMED' }))
    expect(a).toEqual(['deliver', 'fail-delivery', 'mark-paid'])
    expect(a).not.toContain('cancel')
  })

  it('livrée: clôturer en vente', () => {
    expect(availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'DELIVERED', stockStatus: 'CONSUMED', paymentStatus: 'PAID' }))).toEqual(['complete'])
  })
})

describe('availableActions — le parcours d\'un retrait', () => {
  const pickup = (o: Partial<S> = {}) => state({ deliveryMethod: 'PICKUP', ...o })

  it('préparée: prête au retrait (et jamais « expédier »)', () => {
    const a = availableActions(pickup({ status: 'CONFIRMED', fulfillmentStatus: 'PREPARING' }))
    expect(a).toContain('ready')
    expect(a).not.toContain('ship')
  })

  it('prête: remise en main propre (le stock sort ici)', () => {
    const a = availableActions(pickup({ status: 'CONFIRMED', fulfillmentStatus: 'READY_FOR_PICKUP' }))
    expect(a).toContain('hand-over')
    expect(a).not.toContain('deliver')
  })

  it('retirée: clôturer', () => {
    expect(availableActions(pickup({ status: 'CONFIRMED', fulfillmentStatus: 'PICKED_UP', stockStatus: 'CONSUMED', paymentStatus: 'PAID' }))).toEqual(['complete'])
  })
})

describe('availableActions — cas limites', () => {
  it('une livraison ne propose pas « prête au retrait », ni un retrait « livrer »', () => {
    expect(availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'PREPARING' }))).not.toContain('ready')
    expect(availableActions(state({ deliveryMethod: 'PICKUP', status: 'CONFIRMED', fulfillmentStatus: 'OUT_FOR_DELIVERY' }))).not.toContain('deliver')
  })

  it('un stock en conflit ou libéré bloque expédition et remise (le serveur les refuserait)', () => {
    for (const stockStatus of ['CONFLICT', 'RELEASED'] as StockStatus[]) {
      expect(availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'PREPARING', stockStatus }))).not.toContain('ship')
      expect(availableActions(state({ deliveryMethod: 'PICKUP', status: 'CONFIRMED', fulfillmentStatus: 'READY_FOR_PICKUP', stockStatus }))).not.toContain('hand-over')
    }
  })

  it('un conflit de stock laisse annuler (c\'est la sortie normale)', () => {
    expect(availableActions(state({ status: 'CONFIRMED', stockStatus: 'CONFLICT' }))).toContain('cancel')
  })

  it('une commande terminée, annulée ou expirée n\'a plus aucune action de traitement', () => {
    for (const status of ['COMPLETED', 'CANCELLED', 'EXPIRED'] as OrderStatus[]) {
      expect(availableActions(state({ status, paymentStatus: 'PAID', stockStatus: 'RELEASED' })), status).toEqual([])
    }
    expect(availableActions(state({ status: 'CANCELLED', paymentStatus: 'UNPAID', stockStatus: 'RELEASED' }))).toEqual([])
  })

  it('on ne propose d\'encaisser que ce qui n\'est pas encaissé ni remboursé', () => {
    const has = (paymentStatus: PaymentStatus) => availableActions(state({ paymentStatus })).includes('mark-paid')
    for (const p of ['UNPAID', 'PENDING', 'FAILED'] as PaymentStatus[]) expect(has(p), p).toBe(true)
    for (const p of ['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as PaymentStatus[]) expect(has(p), p).toBe(false)
  })

  it('on ne clôture pas pendant un paiement en cours ou un remboursement', () => {
    const base = { status: 'CONFIRMED', fulfillmentStatus: 'DELIVERED', stockStatus: 'CONSUMED' } as Partial<S>
    for (const p of ['PENDING', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED'] as PaymentStatus[]) expect(availableActions(state({ ...base, paymentStatus: p })), p).not.toContain('complete')
    for (const p of ['PAID', 'UNPAID', 'FAILED'] as PaymentStatus[]) expect(availableActions(state({ ...base, paymentStatus: p })), p).toContain('complete')
  })

  it('on ne clôture pas une commande dont la marchandise n\'est pas remise', () => {
    for (const f of ['UNFULFILLED', 'PREPARING', 'READY_FOR_PICKUP', 'OUT_FOR_DELIVERY', 'DELIVERY_FAILED', 'RETURNED'] as FulfillmentStatus[]) {
      expect(availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: f, stockStatus: 'CONSUMED', paymentStatus: 'PAID' })), f).not.toContain('complete')
    }
  })

  it('aucune action n\'apparaît deux fois', () => {
    const a = availableActions(state({ status: 'CONFIRMED', fulfillmentStatus: 'OUT_FOR_DELIVERY', stockStatus: 'CONSUMED' }))
    expect(new Set(a).size).toBe(a.length)
  })
})

describe('nextStep', () => {
  it('met en avant l\'étape qui fait avancer, jamais annuler ni encaisser', () => {
    expect(nextStep(['confirm', 'mark-paid', 'cancel'])).toBe('confirm')
    expect(nextStep(['prepare', 'mark-paid', 'cancel'])).toBe('prepare')
    expect(nextStep(['ship', 'mark-paid', 'cancel'])).toBe('ship')
    expect(nextStep(['deliver', 'fail-delivery', 'mark-paid'])).toBe('deliver')
    expect(nextStep(['complete'])).toBe('complete')
    expect(nextStep(['mark-paid', 'cancel'])).toBeNull()
    expect(nextStep([])).toBeNull()
  })

  it('les actions qui touchent au stock ou à la comptabilité demandent confirmation', () => {
    for (const a of ['ship', 'hand-over', 'complete', 'cancel', 'fail-delivery'] as const) expect(ACTIONS_NEEDING_CONFIRMATION).toContain(a)
    expect(ACTIONS_NEEDING_CONFIRMATION).not.toContain('confirm')
  })
})

describe('divers', () => {
  it('une clôture non payée crée une dette, une clôture payée non', () => {
    expect(completeWillCreateDebt({ paymentStatus: 'UNPAID' })).toBe(true)
    expect(completeWillCreateDebt({ paymentStatus: 'FAILED' })).toBe(true)
    expect(completeWillCreateDebt({ paymentStatus: 'PAID' })).toBe(false)
  })

  it('les niveaux de risque suivent le score', () => {
    expect(riskLevel(0)).toBe('none')
    expect(riskLevel(24)).toBe('none')
    expect(riskLevel(25)).toBe('medium')
    expect(riskLevel(74)).toBe('medium')
    expect(riskLevel(75)).toBe('high')
    expect(riskLevel(100)).toBe('high')
  })

  it('les couleurs des pastilles', () => {
    expect(orderTone('PLACED')).toBe('warn')
    expect(orderTone('CONFIRMED')).toBe('info')
    expect(orderTone('COMPLETED')).toBe('ok')
    expect(orderTone('CANCELLED')).toBe('bad')
    expect(paymentTone('PAID')).toBe('ok')
    expect(paymentTone('FAILED')).toBe('bad')
    expect(fulfillmentTone('DELIVERED')).toBe('ok')
    expect(fulfillmentTone('DELIVERY_FAILED')).toBe('bad')
    expect(fulfillmentTone('UNFULFILLED')).toBe('neutral')
  })

  it('les chiffres d\'un numéro pour WhatsApp, et rien si le numéro est trop court', () => {
    expect(whatsappDigits('+224 620 12 34 56')).toBe('224620123456')
    expect(whatsappDigits('(+224) 620-12-34-56')).toBe('224620123456')
    expect(whatsappDigits('123')).toBeNull()
    expect(whatsappDigits('')).toBeNull()
  })
})
