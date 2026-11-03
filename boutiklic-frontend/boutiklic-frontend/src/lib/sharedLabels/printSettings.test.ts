import { describe, expect, it } from 'vitest'
import { gridLayout, labelsPerPage } from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import {
  DEFAULT_PERSISTED_CONTENT,
  MAX_DPI,
  MAX_OFFSET_MM,
  MAX_PROFILE_NAME_LENGTH,
  MIN_DPI,
  defaultPrintSettings,
  getActiveProfile,
  parsePrintSettings,
  removeProfile,
  sanitizeProfile,
  serializePrintSettings,
  setActiveProfile,
  updateContent,
  upsertProfile,
} from '@boutiklic/shared/src/labels/printSettings'

function idFactory() {
  let n = 0
  return () => `id-${++n}`
}

const roll = (id = 'roll') => createPrintProfile({ id, name: 'Caisse', kind: 'THERMAL_ROLL' })

describe('réglages par défaut', () => {
  it('un appareil neuf a un profil « A4, 24 étiquettes, dialogue système » actif', () => {
    const settings = defaultPrintSettings(idFactory(), 'A4')
    expect(settings.profiles).toHaveLength(1)
    const profile = getActiveProfile(settings)
    expect(profile.kind).toBe('SHEET_A4')
    expect(labelsPerPage(profile.layout)).toBe(24)
    expect(profile.connection).toBe('SYSTEM_DIALOG')
    expect(settings.content).toEqual(DEFAULT_PERSISTED_CONTENT)
  })
})

describe('parsePrintSettings — lecture tolérante', () => {
  it('aller-retour sans perte', () => {
    const original = { ...defaultPrintSettings(idFactory()), profiles: [createPrintProfile({ id: 'a', name: 'Rayon', kind: 'SHEET_A4', presetId: 'a6' }), roll('b')], activeProfileId: 'b' }
    const parsed = parsePrintSettings(serializePrintSettings(original), idFactory())
    expect(parsed).toEqual(original)
  })

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['chaîne vide', ''],
    ['JSON cassé', '{oups'],
    ['tableau', '[]'],
    ['nombre', '42'],
    ['version inconnue', JSON.stringify({ version: 99, profiles: [] })],
    ['profiles absent', JSON.stringify({ version: 1 })],
    ['aucun profil valide', JSON.stringify({ version: 1, profiles: [{ nope: true }, 3, null] })],
  ])('%s → réglages par défaut, sans lever', (_label, raw) => {
    const settings = parsePrintSettings(raw as string | null | undefined, idFactory())
    expect(settings.profiles).toHaveLength(1)
    expect(getActiveProfile(settings).presetId).toBe('small-24')
  })

  it('écarte les profils invalides et garde les valides', () => {
    const good = roll('good')
    const raw = JSON.stringify({ version: 1, activeProfileId: 'good', profiles: [{ id: 'bad', name: 'x', kind: 'SHEET_A4', presetId: 'inconnu' }, good] })
    const settings = parsePrintSettings(raw, idFactory())
    expect(settings.profiles.map((p) => p.id)).toEqual(['good'])
    expect(settings.activeProfileId).toBe('good')
  })

  it('ignore les doublons d’id', () => {
    const raw = JSON.stringify({ version: 1, activeProfileId: 'a', profiles: [roll('a'), { ...roll('a'), name: 'Copie' }] })
    expect(parsePrintSettings(raw, idFactory()).profiles).toHaveLength(1)
  })

  it('un profil actif inconnu retombe sur le premier profil', () => {
    const raw = JSON.stringify({ version: 1, activeProfileId: 'fantome', profiles: [roll('a'), roll('b')] })
    expect(parsePrintSettings(raw, idFactory()).activeProfileId).toBe('a')
  })

  it('options de contenu : valeurs non booléennes ignorées', () => {
    const raw = JSON.stringify({ version: 1, activeProfileId: 'a', profiles: [roll('a')], content: { showCutMarks: true, showBarcode: 'oui', showPromoPrice: 0 } })
    const { content } = parsePrintSettings(raw, idFactory())
    expect(content.showCutMarks).toBe(true)
    expect(content.showBarcode).toBe(DEFAULT_PERSISTED_CONTENT.showBarcode)
    expect(content.showPromoPrice).toBe(DEFAULT_PERSISTED_CONTENT.showPromoPrice)
  })
})

describe('sanitizeProfile', () => {
  it('rejette ce qui n’est pas un profil', () => {
    for (const input of [null, undefined, 'x', 3, [], {}, { id: '', name: 'x', kind: 'SHEET_A4', presetId: 'a6' }, { id: 'a', name: '  ', kind: 'SHEET_A4', presetId: 'a6' }, { id: 'a', name: 'x', kind: 'LASER', presetId: 'a6' }]) {
      expect(sanitizeProfile(input)).toBeNull()
    }
  })

  it('refuse un préréglage incompatible avec le type d’imprimante', () => {
    expect(sanitizeProfile({ id: 'a', name: 'x', kind: 'THERMAL_ROLL', presetId: 'a5' })).toBeNull()
    expect(sanitizeProfile({ id: 'a', name: 'x', kind: 'SHEET_A4', presetId: 'roll-50x30' })).toBeNull()
  })

  it('ré-résout la grille d’un préréglage depuis son id (une grille stockée périmée est ignorée)', () => {
    const stored = { ...createPrintProfile({ id: 'a', name: 'x', kind: 'SHEET_A4', presetId: 'a6' }), layout: gridLayout(9, 9) }
    expect(labelsPerPage(sanitizeProfile(stored)!.layout)).toBe(4)
  })

  it('conserve la grille d’un format personnalisé valide', () => {
    const layout = { ...gridLayout(2, 3), cellWidthMm: 90, cellHeightMm: 80, marginLeftMm: 10, marginTopMm: 5, gutterXMm: 5, gutterYMm: 2, paddingMm: 3 }
    const profile = sanitizeProfile(createPrintProfile({ id: 'c', name: 'Perso', kind: 'SHEET_A4', layout }))
    expect(profile?.presetId).toBe('custom')
    expect(profile?.layout).toEqual(layout)
  })

  it('rejette un format personnalisé qui déborde de la page ou dont un champ manque', () => {
    const tooWide = { ...gridLayout(2, 2), cellWidthMm: 150 }
    expect(sanitizeProfile({ ...createPrintProfile({ id: 'c', name: 'x', kind: 'SHEET_A4' }), presetId: 'custom', layout: tooWide })).toBeNull()
    const { paddingMm: _omitted, ...incomplete } = gridLayout(2, 2)
    expect(sanitizeProfile({ ...createPrintProfile({ id: 'c', name: 'x', kind: 'SHEET_A4' }), presetId: 'custom', layout: incomplete })).toBeNull()
  })

  it('borne le décalage, la résolution et la longueur du nom', () => {
    const p = sanitizeProfile({ ...roll('a'), offsetXMm: 999, offsetYMm: -999, dpi: 1, name: 'N'.repeat(200) })!
    expect(p.offsetXMm).toBe(MAX_OFFSET_MM)
    expect(p.offsetYMm).toBe(-MAX_OFFSET_MM)
    expect(p.dpi).toBe(MIN_DPI)
    expect(p.name).toHaveLength(MAX_PROFILE_NAME_LENGTH)
    expect(sanitizeProfile({ ...roll('a'), dpi: 99999 })!.dpi).toBe(MAX_DPI)
  })

  it('valeurs non numériques → valeurs par défaut', () => {
    const p = sanitizeProfile({ ...roll('a'), offsetXMm: 'beaucoup', dpi: 'haut', connection: 'PIGEON', language: 'BASIC' })!
    expect(p.offsetXMm).toBe(0)
    expect(p.dpi).toBe(203)
    expect(p.connection).toBe('SYSTEM_DIALOG')
    expect(p.language).toBe('HTML')
  })
})

describe('opérations sur les profils', () => {
  const base = () => ({ ...defaultPrintSettings(idFactory()), profiles: [roll('a'), roll('b')], activeProfileId: 'a' })

  it('upsertProfile ajoute un nouveau profil', () => {
    const next = upsertProfile(base(), roll('c'))!
    expect(next.profiles.map((p) => p.id)).toEqual(['a', 'b', 'c'])
  })

  it('upsertProfile remplace un profil existant (même id)', () => {
    const next = upsertProfile(base(), { ...roll('b'), name: 'Renommé', offsetXMm: 1.5 })!
    expect(next.profiles).toHaveLength(2)
    expect(next.profiles[1]).toMatchObject({ id: 'b', name: 'Renommé', offsetXMm: 1.5 })
  })

  it('upsertProfile refuse un profil invalide et laisse les réglages intacts', () => {
    expect(upsertProfile(base(), { ...roll('c'), name: '' })).toBeNull()
  })

  it('removeProfile : le profil actif supprimé est remplacé par le premier restant', () => {
    const next = removeProfile(base(), 'a')
    expect(next.profiles.map((p) => p.id)).toEqual(['b'])
    expect(next.activeProfileId).toBe('b')
  })

  it('removeProfile : garde l’actif si on en supprime un autre', () => {
    expect(removeProfile(base(), 'b').activeProfileId).toBe('a')
  })

  it('removeProfile : ne supprime jamais le dernier profil', () => {
    const single = { ...base(), profiles: [roll('a')] }
    expect(removeProfile(single, 'a')).toBe(single)
  })

  it('removeProfile : id inconnu = aucun changement', () => {
    const settings = base()
    expect(removeProfile(settings, 'zzz')).toBe(settings)
  })

  it('setActiveProfile : ignore un id inconnu', () => {
    const settings = base()
    expect(setActiveProfile(settings, 'b').activeProfileId).toBe('b')
    expect(setActiveProfile(settings, 'zzz')).toBe(settings)
  })

  it('updateContent fusionne et n’accepte que des booléens', () => {
    const next = updateContent(base(), { showCutMarks: true, showShopName: true })
    expect(next.content).toMatchObject({ showCutMarks: true, showShopName: true, showBarcode: true })
    const bad = updateContent(base(), { showBarcode: 'non' as unknown as boolean })
    expect(bad.content.showBarcode).toBe(true)
  })

  it('n’altère pas l’objet d’origine (immutabilité)', () => {
    const settings = base()
    const snapshot = JSON.stringify(settings)
    upsertProfile(settings, roll('c'))
    removeProfile(settings, 'a')
    setActiveProfile(settings, 'b')
    updateContent(settings, { showCutMarks: true })
    expect(JSON.stringify(settings)).toBe(snapshot)
  })
})
