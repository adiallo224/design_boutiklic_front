import * as Print from 'expo-print'
import { printLabelsDocument } from './printLabels'

jest.mock('expo-print', () => ({ printAsync: jest.fn() }))

const printAsync = Print.printAsync as jest.Mock

const A4 = { pageWidthMm: 210, pageHeightMm: 297 }
const ROLL_50X30 = { pageWidthMm: 50, pageHeightMm: 30 }

beforeEach(() => printAsync.mockReset().mockResolvedValue(undefined))

describe('printLabelsDocument', () => {
  it('envoie le HTML avec la taille de page EN POINTS (A4 = 595 × 842) et sans marges', async () => {
    await printLabelsDocument('<html>x</html>', A4)
    expect(printAsync).toHaveBeenCalledTimes(1)
    expect(printAsync).toHaveBeenCalledWith({ html: '<html>x</html>', width: 595, height: 842, margins: { top: 0, right: 0, bottom: 0, left: 0 } })
  })

  it('rouleau thermique 50 × 30 mm = 142 × 85 points', async () => {
    await printLabelsDocument('<html/>', ROLL_50X30)
    expect(printAsync).toHaveBeenCalledWith(expect.objectContaining({ width: 142, height: 85 }))
  })

  it('width/height sont des entiers (Android : Int côté natif)', async () => {
    await printLabelsDocument('<html/>', { pageWidthMm: 148.5, pageHeightMm: 105 })
    const { width, height } = printAsync.mock.calls[0][0]
    expect(Number.isInteger(width)).toBe(true)
    expect(Number.isInteger(height)).toBe(true)
  })

  it('l’annulation du dialogue (iOS rejette) n’est pas une erreur', async () => {
    printAsync.mockRejectedValue(Object.assign(new Error('Printing did not complete'), { code: 'ERR_PRINT_INCOMPLETE' }))
    await expect(printLabelsDocument('<html/>', A4)).resolves.toBeUndefined()
  })

  it('une vraie erreur remonte à l’appelant', async () => {
    const failure = new Error('There was an error while trying to print HTML')
    printAsync.mockRejectedValue(failure)
    await expect(printLabelsDocument('<html/>', A4)).rejects.toBe(failure)
  })
})
