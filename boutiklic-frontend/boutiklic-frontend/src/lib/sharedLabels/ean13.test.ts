import { describe, expect, it } from 'vitest'
import { EAN13_MODULE_COUNT, ean13CheckDigit, encodeEan13, isValidEan13, withEan13CheckDigit } from '@boutiklic/shared/src/labels/ean13'
import { decodeModules } from './zxingDecode.testutil'

describe('clé de contrôle EAN-13', () => {
  it('calcule la clé de vecteurs connus', () => {
    expect(ean13CheckDigit('400638133393')).toBe(1) // 4006381333931
    expect(ean13CheckDigit('590123412345')).toBe(7) // 5901234123457
    expect(ean13CheckDigit('000000000000')).toBe(0)
  })

  it('valide / rejette selon la clé', () => {
    expect(isValidEan13('4006381333931')).toBe(true)
    expect(isValidEan13('4006381333932')).toBe(false)
    expect(isValidEan13('400638133393')).toBe(false) // 12 chiffres
    expect(isValidEan13('40063813339310')).toBe(false)
    expect(isValidEan13('40063813339AB')).toBe(false)
  })

  // Mêmes vecteurs que InternalBarcodeTest (boutiklic-core) : le serveur génère « 20 » + séquence sur 10 chiffres +
  // clé ; si le client calculait une autre clé, l'étiquette serait imprimée en Code 128 au lieu d'EAN-13.
  it('calcule la même clé que le serveur pour les codes internes « 20… »', () => {
    expect(withEan13CheckDigit('200000000001')).toBe('2000000000015')
    expect(withEan13CheckDigit('200000000042')).toBe('2000000000428')
    expect(withEan13CheckDigit('209999999999')).toBe('2099999999998')
  })

  it('complète un code interne avec sa clé', () => {
    const code = withEan13CheckDigit('201234567890')
    expect(code).toHaveLength(13)
    expect(isValidEan13(code)).toBe(true)
  })
})

describe('encodeEan13', () => {
  it('produit 95 modules avec les gardes 101 / 01010 / 101', () => {
    const modules = encodeEan13('4006381333931')
    expect(modules).toHaveLength(EAN13_MODULE_COUNT)
    expect(modules.slice(0, 3)).toBe('101')
    expect(modules.slice(45, 50)).toBe('01010')
    expect(modules.slice(92)).toBe('101')
    expect(modules).toMatch(/^[01]+$/)
  })

  it('refuse un code invalide', () => {
    expect(() => encodeEan13('4006381333932')).toThrow()
  })

  // Chaque 1ᵉʳ chiffre (0-9) impose une parité L/G différente : on les couvre toutes.
  it.each([...Array(10).keys()].map(String))('est relu à l’identique par ZXing — 1ᵉʳ chiffre %s', (first) => {
    const code = withEan13CheckDigit(`${first}12345678901`)
    const { text } = decodeModules(encodeEan13(code))
    // ZXing rend un EAN-13 commençant par 0 comme un UPC-A (12 chiffres, sans le 0 initial).
    const normalized = text.length === 12 ? `0${text}` : text
    expect(normalized).toBe(code)
  })

  it('est relu à l’identique pour des vecteurs connus', () => {
    for (const code of ['4006381333931', '5901234123457', '3017620422003']) {
      expect(decodeModules(encodeEan13(code)).text).toBe(code)
    }
  })
})
