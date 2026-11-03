import { describe, expect, it } from 'vitest'
import { MAX_AREAS, MAX_AREA_LENGTH, areasProblem, areasToText, normalizeArea, parseAreas } from './deliveryAreas'

describe('parseAreas', () => {
  it('accepte une ligne par lieu, ou des virgules, ou des points-virgules', () => {
    expect(parseAreas('Kaloum\nDixinn\nRatoma')).toEqual(['Kaloum', 'Dixinn', 'Ratoma'])
    expect(parseAreas('Kaloum, Dixinn ; Ratoma')).toEqual(['Kaloum', 'Dixinn', 'Ratoma'])
    expect(parseAreas('Kaloum,\n\nDixinn,,')).toEqual(['Kaloum', 'Dixinn'])
  })

  it('retire les espaces et les lignes vides', () => {
    expect(parseAreas('  Kaloum  \n   \n\tDixinn\t')).toEqual(['Kaloum', 'Dixinn'])
    expect(parseAreas('')).toEqual([])
    expect(parseAreas(' , ; \n ')).toEqual([])
  })

  it('ignore les doublons sans tenir compte de la casse, des accents ni des tirets, en gardant la première écriture', () => {
    expect(parseAreas('Hamdallayé\nhamdallaye\nHAMDALLAYE')).toEqual(['Hamdallayé'])
    expect(parseAreas('Sainte-Marie, sainte marie')).toEqual(['Sainte-Marie'])
  })

  it('conserve les noms composés avec espaces ou tirets', () => {
    expect(parseAreas('Camayenne Corniche, Nongo-Taady')).toEqual(['Camayenne Corniche', 'Nongo-Taady'])
  })

  it('est le contraire de areasToText', () => {
    const areas = ['Kaloum', 'Sainte-Marie', 'Hamdallayé']
    expect(parseAreas(areasToText(areas))).toEqual(areas)
  })
})

describe('normalizeArea', () => {
  it.each([
    ['Kaloum', 'kaloum'],
    ['  KALOÜM ', 'kaloum'],
    ['Sainte-Marie', 'sainte marie'],
    ['Sainte   Marie', 'sainte marie'],
    ['Hamdallayé', 'hamdallaye'],
  ])('%j -> %j', (input, expected) => expect(normalizeArea(input)).toBe(expected))
})

describe('areasProblem', () => {
  it('signale trop de lieux ou un nom trop long, comme le serveur', () => {
    expect(areasProblem(['a', 'b'])).toBeNull()
    expect(areasProblem(Array.from({ length: MAX_AREAS }, (_, i) => `lieu ${i}`))).toBeNull()
    expect(areasProblem(Array.from({ length: MAX_AREAS + 1 }, (_, i) => `lieu ${i}`))).toBe('tooMany')
    expect(areasProblem(['x'.repeat(MAX_AREA_LENGTH)])).toBeNull()
    expect(areasProblem(['x'.repeat(MAX_AREA_LENGTH + 1)])).toBe('tooLong')
  })
})
