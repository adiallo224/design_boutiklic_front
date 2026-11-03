import { isPrintCancelled } from './printCancel'

describe('isPrintCancelled', () => {
  it('reconnaît l’annulation iOS (code natif et message d’expo-print)', () => {
    expect(isPrintCancelled({ code: 'ERR_PRINT_INCOMPLETE', message: 'x' })).toBe(true)
    expect(isPrintCancelled(new Error('Printing did not complete'))).toBe(true)
    expect(isPrintCancelled(new Error('printing DID NOT COMPLETE'))).toBe(true)
    expect(isPrintCancelled(new Error('Printer picker has been cancelled'))).toBe(true)
  })

  it('ne masque pas les vraies erreurs', () => {
    expect(isPrintCancelled(new Error('There was an error while trying to print HTML'))).toBe(false)
    expect(isPrintCancelled({ code: 'ERR_PRINTING_JOB_FAILED', message: 'Printing job failed' })).toBe(false)
  })

  it('tolère n’importe quelle valeur lancée', () => {
    for (const value of [null, undefined, 'texte', 42, {}, [], { message: 3 }]) {
      expect(isPrintCancelled(value)).toBe(false)
    }
  })
})
