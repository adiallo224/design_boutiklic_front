import { describe, expect, it } from 'vitest'
import {
  A4_HEIGHT_MM,
  A4_PRESETS,
  A4_WIDTH_MM,
  ROLL_PRESETS,
  gridLayout,
  labelsPerPage,
  layoutForPreset,
  rollLayout,
  tierForLayout,
  validateLayout,
} from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'

describe('formats A4 proposés à l’utilisateur', () => {
  // [id, étiquettes par page, largeur mm, hauteur mm, gabarit] — cf. étude §3.3
  const expected: [string, number, number, number, string][] = [
    ['a4-full', 1, 210, 297, 'XL'],
    ['a5', 2, 210, 148.5, 'XL'],
    ['a6', 4, 105, 148.5, 'L'],
    ['std-8', 8, 105, 74.25, 'M'],
    ['std-10', 10, 105, 59.4, 'M'],
    ['std-12', 12, 105, 49.5, 'M'],
    ['small-21', 21, 70, 42.429, 'S'],
    ['small-24', 24, 70, 37.125, 'S'],
  ]

  it('propose exactement les 8 préréglages attendus', () => {
    expect(A4_PRESETS.map((p) => p.id)).toEqual(expected.map((e) => e[0]))
  })

  it.each(expected)('%s : %i par page, %f × %f mm, gabarit %s', (id, perPage, width, height, tier) => {
    const layout = layoutForPreset(id)
    expect(layout).not.toBeNull()
    expect(labelsPerPage(layout!)).toBe(perPage)
    expect(layout!.cellWidthMm).toBeCloseTo(width, 2)
    expect(layout!.cellHeightMm).toBeCloseTo(height, 2)
    expect(tierForLayout(layout!)).toBe(tier)
    expect(validateLayout(layout!)).toEqual([])
  })

  it('les cases recouvrent exactement la page A4 (papier ordinaire découpé)', () => {
    for (const preset of A4_PRESETS) {
      const layout = gridLayout(preset.columns, preset.rows)
      expect(layout.cellWidthMm * layout.columns).toBeCloseTo(A4_WIDTH_MM, 1)
      expect(layout.cellHeightMm * layout.rows).toBeCloseTo(A4_HEIGHT_MM, 1)
    }
  })

  it('A5 : deux parts de 210 × 148,5 mm, en paysage', () => {
    const layout = layoutForPreset('a5')!
    expect(layout.cellWidthMm).toBeGreaterThan(layout.cellHeightMm)
  })

  it('le remplissage interne protège de la marge non imprimable (≥ 4 mm)', () => {
    for (const preset of A4_PRESETS) {
      expect(gridLayout(preset.columns, preset.rows).paddingMm).toBeGreaterThanOrEqual(4)
    }
  })
})

describe('rouleaux thermiques', () => {
  it('une étiquette = une page, de la taille de l’étiquette', () => {
    for (const roll of ROLL_PRESETS) {
      const layout = layoutForPreset(roll.id)!
      expect(labelsPerPage(layout)).toBe(1)
      expect(layout.pageWidthMm).toBe(roll.widthMm)
      expect(layout.pageHeightMm).toBe(roll.heightMm)
      expect(layout.cellWidthMm).toBe(roll.widthMm)
      expect(tierForLayout(layout)).toBe('S')
      expect(validateLayout(layout)).toEqual([])
    }
  })

  it('accepte une taille libre', () => {
    const layout = rollLayout(58, 40)
    expect(layout.cellWidthMm).toBe(58)
    expect(validateLayout(layout)).toEqual([])
  })
})

describe('layoutForPreset', () => {
  it('renvoie null pour un id inconnu', () => {
    expect(layoutForPreset('inconnu')).toBeNull()
    expect(layoutForPreset('custom')).toBeNull()
  })
})

describe('validateLayout — format personnalisé', () => {
  it('accepte une planche autocollante avec marges et gouttières', () => {
    // 3 × 8 étiquettes de 63,5 × 33,9 mm avec gouttières de 2,5 mm et marges de 7,25 / 15,15 mm
    const layout = {
      ...gridLayout(3, 8),
      cellWidthMm: 63.5,
      cellHeightMm: 33.9,
      marginLeftMm: 7.25,
      marginTopMm: 13.1,
      gutterXMm: 2.5,
      gutterYMm: 0,
      paddingMm: 3,
    }
    expect(validateLayout(layout)).toEqual([])
  })

  it('refuse une grille qui dépasse la page', () => {
    const layout = { ...gridLayout(3, 8), cellWidthMm: 80 } // 3 × 80 = 240 > 210
    expect(validateLayout(layout).join(' ')).toContain('largeur')
  })

  it('refuse des valeurs non positives ou non entières', () => {
    expect(validateLayout({ ...gridLayout(2, 2), cellWidthMm: 0 })).not.toEqual([])
    expect(validateLayout({ ...gridLayout(2, 2), columns: 1.5 })).not.toEqual([])
    expect(validateLayout({ ...gridLayout(2, 2), rows: 0 })).not.toEqual([])
    expect(validateLayout({ ...gridLayout(2, 2), marginTopMm: -1 })).not.toEqual([])
  })

  it('refuse un remplissage qui mange toute l’étiquette', () => {
    expect(validateLayout({ ...gridLayout(3, 8), paddingMm: 20 })).not.toEqual([])
  })
})

describe('createPrintProfile', () => {
  it('sans configuration : A4 24 étiquettes, dialogue système, 300 dpi', () => {
    const profile = createPrintProfile({ id: 'p1', name: 'Défaut', kind: 'SHEET_A4' })
    expect(profile.presetId).toBe('small-24')
    expect(labelsPerPage(profile.layout)).toBe(24)
    expect(profile.connection).toBe('SYSTEM_DIALOG')
    expect(profile.language).toBe('HTML')
    expect(profile.dpi).toBe(300)
    expect(profile.offsetXMm).toBe(0)
  })

  it('thermique : rouleau 50 × 30, 203 dpi', () => {
    const profile = createPrintProfile({ id: 'p2', name: 'Caisse', kind: 'THERMAL_ROLL' })
    expect(profile.presetId).toBe('roll-50x30')
    expect(profile.dpi).toBe(203)
  })

  it('une grille personnalisée impose presetId = custom', () => {
    const profile = createPrintProfile({ id: 'p3', name: 'Perso', kind: 'SHEET_A4', layout: gridLayout(2, 3) })
    expect(profile.presetId).toBe('custom')
  })

  it('refuse un préréglage inconnu', () => {
    expect(() => createPrintProfile({ id: 'p4', name: 'X', kind: 'SHEET_A4', presetId: 'nope' })).toThrow()
  })
})
