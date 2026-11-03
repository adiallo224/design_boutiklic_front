import { describe, expect, it } from 'vitest'
import { resolveAmounts, toggleMethod } from '@boutiklic/shared/src/payments/splitPayments'

describe('resolveAmounts', () => {
  it('laisse CASH seul aligné sur ce qui est saisi', () => {
    expect(resolveAmounts({ CASH: 150 }, 150)).toEqual({ CASH: 150 })
  })

  it('fait absorber le reste par CASH en paiement mixte', () => {
    expect(resolveAmounts({ CASH: 150, MOBILE_MONEY_WAVE: 20 }, 150)).toEqual({ CASH: 130, MOBILE_MONEY_WAVE: 20 })
  })

  it('recalcule CASH avec plusieurs autres moyens actifs', () => {
    expect(resolveAmounts({ CASH: 130, MOBILE_MONEY_WAVE: 20, MOBILE_MONEY_ORANGE: 15 }, 150)).toEqual({
      CASH: 115,
      MOBILE_MONEY_WAVE: 20,
      MOBILE_MONEY_ORANGE: 15,
    })
  })

  it('clampe CASH à 0 quand les autres moyens dépassent le total net (dépassement)', () => {
    expect(resolveAmounts({ CASH: 150, MOBILE_MONEY_WAVE: 200 }, 150)).toEqual({ CASH: 0, MOBILE_MONEY_WAVE: 200 })
  })

  it('ne touche pas aux montants sans CASH actif', () => {
    expect(resolveAmounts({ MOBILE_MONEY_WAVE: 20, MOBILE_MONEY_ORANGE: 15 }, 150)).toEqual({
      MOBILE_MONEY_WAVE: 20,
      MOBILE_MONEY_ORANGE: 15,
    })
  })

  it('recalcule CASH quand le total net change (rabais appliqué après répartition)', () => {
    expect(resolveAmounts({ CASH: 130, MOBILE_MONEY_WAVE: 20 }, 140)).toEqual({ CASH: 120, MOBILE_MONEY_WAVE: 20 })
  })
})

describe('toggleMethod', () => {
  it('retire un moyen déjà actif', () => {
    expect(toggleMethod({ CASH: 130, MOBILE_MONEY_WAVE: 20 }, 'MOBILE_MONEY_WAVE', 150)).toEqual({ CASH: 130 })
  })

  it('démarre un nouveau moyen à 0 quand CASH est déjà actif (le caissier saisit, CASH suit)', () => {
    expect(toggleMethod({ CASH: 150 }, 'MOBILE_MONEY_WAVE', 150)).toEqual({ CASH: 150, MOBILE_MONEY_WAVE: 0 })
  })

  it('coche CASH en dernier : il récupère le reste non alloué', () => {
    expect(toggleMethod({ MOBILE_MONEY_WAVE: 20 }, 'CASH', 150)).toEqual({ MOBILE_MONEY_WAVE: 20, CASH: 130 })
  })

  it('préremplit avec le reste non alloué quand CASH est absent (comportement historique)', () => {
    expect(toggleMethod({ MOBILE_MONEY_WAVE: 20 }, 'MOBILE_MONEY_ORANGE', 150)).toEqual({ MOBILE_MONEY_WAVE: 20, MOBILE_MONEY_ORANGE: 130 })
  })
})
