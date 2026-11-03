import { describe, expect, it } from 'vitest'
import { CODE128_MAX_LENGTH, CODE128_PATTERNS, code128Values, encodeCode128, isCode128Encodable } from '@boutiklic/shared/src/labels/code128'
import { decodeModules } from './zxingDecode.testutil'

describe('table des symboles Code 128', () => {
  it('a 107 symboles : 106 de 11 modules, l’arrêt de 13', () => {
    expect(CODE128_PATTERNS).toHaveLength(107)
    CODE128_PATTERNS.slice(0, 106).forEach((pattern, value) => {
      expect(pattern, `symbole ${value}`).toMatch(/^\d{6}$/)
      expect([...pattern].reduce((sum, w) => sum + Number(w), 0), `symbole ${value}`).toBe(11)
    })
    expect(CODE128_PATTERNS[106]).toBe('2331112')
  })

  it('n’a aucun symbole en double', () => {
    expect(new Set(CODE128_PATTERNS).size).toBe(107)
  })
})

describe('code128Values', () => {
  it('choisit le sous-ensemble C pour une suite paire de chiffres', () => {
    // Départ C (105), 12, 34, clé, arrêt (106) — clé = (105 + 1*12 + 2*34) % 103 = 185 % 103 = 82
    expect(code128Values('1234')).toEqual([105, 12, 34, 82, 106])
  })

  it('reste en B pour du texte', () => {
    const values = code128Values('AB')
    expect(values[0]).toBe(104)
    expect(values.slice(1, 3)).toEqual(['A'.charCodeAt(0) - 32, 'B'.charCodeAt(0) - 32])
  })

  it('accepte 1 à 50 caractères ASCII imprimables et rien d’autre', () => {
    expect(isCode128Encodable('A')).toBe(true)
    expect(isCode128Encodable('x'.repeat(CODE128_MAX_LENGTH))).toBe(true)
    expect(isCode128Encodable('x'.repeat(CODE128_MAX_LENGTH + 1))).toBe(false)
    expect(isCode128Encodable('')).toBe(false)
    expect(isCode128Encodable('café')).toBe(false)
    expect(isCode128Encodable('tab\t')).toBe(false)
    expect(() => encodeCode128('café')).toThrow()
  })
})

describe('encodeCode128 relu par ZXing', () => {
  const roundTrip = (value: string) => decodeModules(encodeCode128(value)).text

  it.each([
    ['texte + tiret', 'ABC-123'],
    ['chiffres pairs (C)', '1234567890'],
    ['chiffres impairs (B puis C)', '12345'],
    ['3 chiffres', '123'],
    ['2 chiffres', '12'],
    ['1 chiffre', '7'],
    ['chiffres puis lettres', '12345678AB'],
    ['lettres, chiffres, lettres', 'AB12345678CD'],
    ['chiffres isolés entre lettres', 'A1B2C3'],
    ['EAN-13 à clé invalide', '4006381333932'],
    ['EAN-8', '96385074'],
    ['espaces et ponctuation', 'Ref: 12/AB #7'],
    ['longueur maximale', 'AZ09'.repeat(12) + 'ab'],
  ])('%s', (_label, value) => {
    expect(roundTrip(value)).toBe(value)
  })

  // Couvre toute la partie « données » du sous-ensemble B.
  it('relit chacun des 95 caractères ASCII imprimables', () => {
    for (let code = 32; code <= 126; code++) {
      const value = `A${String.fromCharCode(code)}Z`
      expect(roundTrip(value), `caractère ${code}`).toBe(value)
    }
  })

  // Couvre toute la partie « données » du sous-ensemble C (paires 00–99).
  it('relit toutes les paires de chiffres 00–99', () => {
    for (let pair = 0; pair < 100; pair++) {
      const digits = String(pair).padStart(2, '0')
      const value = `${digits}${digits}` // 4 chiffres → sous-ensemble C
      expect(roundTrip(value), `paire ${digits}`).toBe(value)
    }
  })
})
