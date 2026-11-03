import { describe, expect, it } from 'vitest'
import { BarcodeEncodingError, encodeBarcode, isEncodableBarcode, snapModuleWidthMm, totalModules } from '@boutiklic/shared/src/labels/barcode'
import { barcodePath, barcodeSvg } from '@boutiklic/shared/src/labels/barcodeSvg'
import { withEan13CheckDigit } from '@boutiklic/shared/src/labels/ean13'
import { decodeModules } from './zxingDecode.testutil'

describe('encodeBarcode — choix de la symbologie', () => {
  it('EAN-13 pour 13 chiffres à clé valide (EAN fabricant ou code interne « 20… »)', () => {
    expect(encodeBarcode('4006381333931').symbology).toBe('EAN13')
    expect(encodeBarcode(withEan13CheckDigit('201234567890')).symbology).toBe('EAN13')
  })

  it('Code 128 pour tout le reste, sans rejeter les codes existants à clé invalide', () => {
    expect(encodeBarcode('4006381333932').symbology).toBe('CODE128') // clé fausse
    expect(encodeBarcode('96385074').symbology).toBe('CODE128') // EAN-8
    expect(encodeBarcode('REF-42/B').symbology).toBe('CODE128')
  })

  it('ignore les espaces autour', () => {
    expect(encodeBarcode('  4006381333931 ').value).toBe('4006381333931')
  })

  it('formate le texte lisible', () => {
    expect(encodeBarcode('4006381333931').humanReadable).toBe('4 006381 333931')
    expect(encodeBarcode('REF-42').humanReadable).toBe('REF-42')
  })

  it('lève BarcodeEncodingError pour une valeur non encodable', () => {
    expect(() => encodeBarcode('')).toThrow(BarcodeEncodingError)
    expect(() => encodeBarcode('éàü')).toThrow(BarcodeEncodingError)
  })

  it('isEncodableBarcode', () => {
    expect(isEncodableBarcode('4006381333931')).toBe(true)
    expect(isEncodableBarcode('REF-42')).toBe(true)
    expect(isEncodableBarcode('')).toBe(false)
    expect(isEncodableBarcode(null)).toBe(false)
    expect(isEncodableBarcode(undefined)).toBe(false)
    expect(isEncodableBarcode('éàü')).toBe(false)
  })

  it('totalModules inclut les deux zones de silence', () => {
    const ean = encodeBarcode('4006381333931')
    expect(totalModules(ean)).toBe(95 + 2 * ean.quietZoneModules)
  })
})

describe('snapModuleWidthMm — barres sur un nombre entier de points', () => {
  it('à 203 dpi (point = 0,125 mm), 0,3 mm devient 2 points', () => {
    const dot = 25.4 / 203
    expect(snapModuleWidthMm(0.3, 203)).toBeCloseTo(2 * dot, 6)
    expect(snapModuleWidthMm(0.3, 203) / dot).toBeCloseTo(2, 6)
  })

  it('arrondit toujours vers le bas, jamais plus large que demandé', () => {
    for (const dpi of [203, 300, 600]) {
      for (const target of [0.19, 0.25, 0.33, 0.4, 0.55, 1.1]) {
        expect(snapModuleWidthMm(target, dpi)).toBeLessThanOrEqual(target + 1e-9)
      }
    }
  })

  it('reste un multiple entier de points', () => {
    for (const dpi of [203, 300, 600]) {
      const dot = 25.4 / dpi
      for (const target of [0.21, 0.37, 0.52, 0.9]) {
        const dots = snapModuleWidthMm(target, dpi) / dot
        expect(Math.abs(dots - Math.round(dots))).toBeLessThan(1e-6)
      }
    }
  })

  it('vaut au minimum 1 point', () => {
    expect(snapModuleWidthMm(0.001, 203)).toBeCloseTo(25.4 / 203, 6)
  })
})

/** Reconstruit la suite de modules depuis le chemin SVG (`M x 0 h w v 1 h -w z`), pour vérifier le rendu. */
function modulesFromPath(path: string, quiet: number, length: number): string {
  const bits = Array<string>(length).fill('0')
  for (const match of path.matchAll(/M(\d+) 0h(\d+)v1h-\d+z/g)) {
    const start = Number(match[1]) - quiet
    for (let i = 0; i < Number(match[2]); i++) bits[start + i] = '1'
  }
  return bits.join('')
}

describe('barcodeSvg', () => {
  it.each(['4006381333931', 'REF-42/B', '1234567890'])('le chemin restitue exactement les modules — %s', (value) => {
    const encoding = encodeBarcode(value)
    const rebuilt = modulesFromPath(barcodePath(encoding), encoding.quietZoneModules, encoding.modules.length)
    expect(rebuilt).toBe(encoding.modules)
    // et le rendu du chemin reste lisible
    expect(decodeModules(rebuilt).text).toBe(value)
  })

  it('fusionne les barres contiguës (moins de chemins que de modules à 1)', () => {
    const encoding = encodeBarcode('4006381333931')
    const runs = (barcodePath(encoding).match(/M/g) ?? []).length
    expect(runs).toBeLessThan([...encoding.modules].filter((m) => m === '1').length)
  })

  it('dimensionne le SVG en mm : largeur = modules × largeur de module', () => {
    const encoding = encodeBarcode('4006381333931')
    const svg = barcodeSvg(encoding, { moduleWidthMm: 0.25, heightMm: 12 })
    expect(svg).toContain(`width="${Number((totalModules(encoding) * 0.25).toFixed(4))}mm"`)
    expect(svg).toContain('height="12mm"')
    expect(svg).toContain('preserveAspectRatio="none"')
    expect(svg).toContain(`viewBox="0 0 ${totalModules(encoding)} 1"`)
  })
})
