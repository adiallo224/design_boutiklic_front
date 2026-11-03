/**
 * Encodeur EAN-13 — sans dépendance, pur (utilisable dans le HTML de `expo-print` comme dans le navigateur).
 * Structure : garde 101 · 6 chiffres gauche (parité L/G selon le 1ᵉʳ chiffre) · garde centrale 01010 ·
 * 6 chiffres droite (R) · garde 101 = 95 modules.
 */

const L_CODES = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011']
const G_CODES = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111']
const R_CODES = L_CODES.map((code) => [...code].map((bit) => (bit === '1' ? '0' : '1')).join(''))
/** Parité des 6 chiffres de gauche selon le 1ᵉʳ chiffre (qui n'est pas dessiné, il n'est porté que par la parité). */
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL']

export const EAN13_MODULE_COUNT = 95

export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new Error('ean13CheckDigit : 12 chiffres attendus')
  let sum = 0
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3)
  return (10 - (sum % 10)) % 10
}

export function isValidEan13(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
}

/** Complète 12 chiffres avec leur clé de contrôle (ex. code interne « 20… »). */
export function withEan13CheckDigit(first12: string): string {
  return first12 + ean13CheckDigit(first12)
}

export function encodeEan13(code: string): string {
  if (!isValidEan13(code)) throw new Error(`EAN-13 invalide : ${code}`)
  const digits = [...code].map(Number)
  const parity = PARITY[digits[0]]
  let modules = '101'
  for (let i = 0; i < 6; i++) {
    const table = parity[i] === 'L' ? L_CODES : G_CODES
    modules += table[digits[i + 1]]
  }
  modules += '01010'
  for (let i = 7; i < 13; i++) modules += R_CODES[digits[i]]
  modules += '101'
  return modules
}
