import { encodeCode128, isCode128Encodable } from './code128'
import { encodeEan13, isValidEan13 } from './ean13'
import type { BarcodeEncoding } from './types'

export class BarcodeEncodingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BarcodeEncodingError'
  }
}

/** Zones de silence en modules (EAN-13 : 11 à gauche, 7 à droite au minimum — 11 des deux côtés par simplicité). */
const EAN13_QUIET_ZONE = 11
const CODE128_QUIET_ZONE = 10

export function isEncodableBarcode(value: string | null | undefined): value is string {
  if (value == null) return false
  const v = value.trim()
  return isValidEan13(v) || isCode128Encodable(v)
}

/**
 * Choisit la symbologie (cf. étude §3.1) : EAN-13 si 13 chiffres avec clé valide (EAN fabricant ou code
 * interne), sinon Code 128 — jamais de rejet d'un code existant à clé invalide, il reste imprimable et le
 * scan redonne exactement la même chaîne.
 */
export function encodeBarcode(raw: string): BarcodeEncoding {
  const value = raw.trim()
  if (isValidEan13(value)) {
    return {
      symbology: 'EAN13',
      value,
      modules: encodeEan13(value),
      humanReadable: `${value[0]} ${value.slice(1, 7)} ${value.slice(7)}`,
      quietZoneModules: EAN13_QUIET_ZONE,
    }
  }
  if (isCode128Encodable(value)) {
    return {
      symbology: 'CODE128',
      value,
      modules: encodeCode128(value),
      humanReadable: value,
      quietZoneModules: CODE128_QUIET_ZONE,
    }
  }
  throw new BarcodeEncodingError(`Code-barres non encodable : ${JSON.stringify(raw)}`)
}

/** Largeur totale (barres + zones de silence) en modules. */
export function totalModules(encoding: BarcodeEncoding): number {
  return encoding.modules.length + 2 * encoding.quietZoneModules
}

/**
 * Cale la largeur d'un module sur un nombre entier de points de l'imprimante (cf. étude §5.1) : sur une
 * thermique à 203 dpi, 1 point = 0,125 mm ; une barre de 0,3 mm ferait tantôt 2, tantôt 3 points et le scan
 * échouerait. On arrondit vers le bas (jamais plus large que l'espace disponible), minimum 1 point.
 */
export function snapModuleWidthMm(targetMm: number, dpi: number): number {
  const dotMm = 25.4 / dpi
  const dots = Math.max(1, Math.floor(targetMm / dotMm + 1e-9))
  return dots * dotMm
}
