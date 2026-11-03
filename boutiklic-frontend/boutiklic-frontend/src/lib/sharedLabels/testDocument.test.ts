import { describe, expect, it } from 'vitest'
import { A4_PRESETS, labelsPerPage } from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import { TEST_BARCODE, buildTestDocument } from '@boutiklic/shared/src/labels/testDocument'
import { isValidEan13 } from '@boutiklic/shared/src/labels/ean13'

describe('buildTestDocument', () => {
  it('le code d’essai est un EAN-13 valide de la plage interne (préfixe 20)', () => {
    expect(isValidEan13(TEST_BARCODE)).toBe(true)
    expect(TEST_BARCODE.startsWith('20')).toBe(true)
  })

  it.each(A4_PRESETS.map((p) => p.id))('remplit exactement une page pleine — %s', (presetId) => {
    const profile = createPrintProfile({ id: presetId, name: presetId, kind: 'SHEET_A4', presetId })
    const doc = buildTestDocument(profile)
    expect(doc.pageCount).toBe(1)
    expect(doc.labelCount).toBe(labelsPerPage(profile.layout))
    expect(doc.html).toContain('class="cell cut"')
    expect(doc.issues).toEqual([])
  })

  it('rouleau : une seule étiquette d’essai', () => {
    const doc = buildTestDocument(createPrintProfile({ id: 'r', name: 'r', kind: 'THERMAL_ROLL' }))
    expect(doc.pageCount).toBe(1)
    expect(doc.labelCount).toBe(1)
  })

  it('tient compte du décalage du profil (c’est son but : caler l’imprimante)', () => {
    const profile = { ...createPrintProfile({ id: 'a', name: 'a', kind: 'SHEET_A4', presetId: 'std-8' }), offsetXMm: 2, offsetYMm: 3 }
    expect(buildTestDocument(profile).html).toContain('left:2mm;top:3mm;')
  })

  it('nom d’exemple et titre personnalisables (traduction)', () => {
    const profile = createPrintProfile({ id: 'a', name: 'a', kind: 'SHEET_A4' })
    const { html } = buildTestDocument(profile, { sampleName: 'Test label', title: 'Test page' })
    expect(html).toContain('Test label')
    expect(html).toContain('<title>Test page</title>')
  })
})
