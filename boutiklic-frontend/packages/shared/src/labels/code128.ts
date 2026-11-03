/**
 * Encodeur Code 128 (sous-ensembles B et C) — sans dépendance. Encode toute chaîne ASCII imprimable
 * (32–126), soit tout ce que peut contenir `products.barcode` ; la lecture restitue exactement la même
 * chaîne, donc la recherche caisse par code-barres reste valide.
 * Sous-ensemble C (paires de chiffres) pour les suites de ≥ 4 chiffres : symbole plus court, donc
 * barres plus larges à surface égale.
 */

/** Largeurs alternées barre/espace de chaque symbole (0–102 données, 103–105 départ A/B/C, 106 arrêt). */
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
] as const

const CODE_C = 99
const CODE_B = 100
const START_B = 104
const START_C = 105
const STOP = 106

export const CODE128_MAX_LENGTH = 50

export function isCode128Encodable(value: string): boolean {
  if (value.length === 0 || value.length > CODE128_MAX_LENGTH) return false
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i)
    if (c < 32 || c > 126) return false
  }
  return true
}

const isDigit = (ch: string | undefined) => ch !== undefined && ch >= '0' && ch <= '9'

/** Suite de valeurs de symboles (départ, données, clé de contrôle, arrêt). Exposée pour les tests. */
export function code128Values(value: string): number[] {
  if (!isCode128Encodable(value)) {
    throw new Error(`Code 128 : valeur non encodable (ASCII 32–126, 1 à ${CODE128_MAX_LENGTH} caractères) : ${JSON.stringify(value)}`)
  }
  const n = value.length
  const values: number[] = []
  let set: 'B' | 'C' | null = null
  let i = 0

  const digitRun = (from: number) => {
    let k = from
    while (k < n && isDigit(value[k])) k++
    return k - from
  }

  while (i < n) {
    if (set !== 'C') {
      let run = digitRun(i)
      if (run >= 4 || (set === null && run === n && run >= 2)) {
        if (run % 2 === 1) {
          // Suite impaire : le 1ᵉʳ chiffre part en B pour que le reste tombe en paires.
          if (set === null) {
            values.push(START_B)
            set = 'B'
          }
          values.push(value.charCodeAt(i) - 32)
          i++
          run--
        }
        values.push(set === null ? START_C : CODE_C)
        set = 'C'
        continue
      }
      if (set === null) {
        values.push(START_B)
        set = 'B'
      }
      values.push(value.charCodeAt(i) - 32)
      i++
    } else if (isDigit(value[i]) && isDigit(value[i + 1])) {
      values.push(Number(value.slice(i, i + 2)))
      i += 2
    } else {
      values.push(CODE_B)
      set = 'B'
    }
  }

  let checksum = values[0]
  for (let k = 1; k < values.length; k++) checksum += k * values[k]
  values.push(checksum % 103, STOP)
  return values
}

function patternToModules(pattern: string): string {
  let modules = ''
  for (let i = 0; i < pattern.length; i++) modules += (i % 2 === 0 ? '1' : '0').repeat(Number(pattern[i]))
  return modules
}

export function encodeCode128(value: string): string {
  return code128Values(value).map((v) => patternToModules(PATTERNS[v])).join('')
}

/** Exposé pour les tests d'intégrité de la table. */
export const CODE128_PATTERNS: readonly string[] = PATTERNS
