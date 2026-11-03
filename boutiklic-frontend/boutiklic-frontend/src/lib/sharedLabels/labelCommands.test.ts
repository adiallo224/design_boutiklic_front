import { describe, expect, it } from 'vitest'
import { TIERS, buildLabelsDocument, computeLabelMetrics, type RenderContext } from '@boutiklic/shared/src/labels/buildLabelsDocument'
import {
  LabelCommandsError,
  buildLabelCommands,
  buildTestCommands,
  chooseBitmapFont,
  encodePayload,
  planLabel,
  wrapText,
  type Primitive,
} from '@boutiklic/shared/src/labels/labelCommands'
import { ROLL_PRESETS, tierForLayout } from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import { DEFAULT_CONTENT_OPTIONS, type LabelModel, type PrintProfile } from '@boutiklic/shared/src/labels/types'

const roll = (language: 'TSPL' | 'ZPL', presetId = 'roll-50x30', extra: Partial<Parameters<typeof createPrintProfile>[0]> = {}): PrintProfile =>
  createPrintProfile({ id: 'r', name: 'Caisse', kind: 'THERMAL_ROLL', presetId, connection: 'USB_RAW', language, deviceId: 'TSC TE200', ...extra })

const label = (overrides: Partial<LabelModel> = {}): LabelModel => ({
  productId: 'p1',
  name: 'Savon de Marseille',
  price: 12500,
  currency: 'GNF',
  barcode: '4006381333931',
  copies: 1,
  ...overrides,
})

/** Plan d'une étiquette (positions en points) — mêmes métriques que le rendu HTML. */
function planOf(model: LabelModel, profile: PrintProfile, options: Partial<typeof DEFAULT_CONTENT_OPTIONS> = {}) {
  const ctx: RenderContext = {
    layout: profile.layout,
    spec: TIERS[tierForLayout(profile.layout)],
    options: { ...DEFAULT_CONTENT_OPTIONS, ...options },
    dpi: profile.dpi,
    issues: [],
    svgCache: new Map(),
    tooSmallReported: new Set(),
  }
  return { plan: planLabel(computeLabelMetrics(model, ctx), profile), issues: ctx.issues }
}

describe('valeurs de référence (régression de la sortie exacte)', () => {
  it('TSPL — rouleau 50 × 30, EAN-13, 2 exemplaires', () => {
    const job = buildLabelCommands([label({ copies: 2 })], roll('TSPL'))
    expect(job.payload).toBe(
      [
        'SIZE 50 mm,30 mm',
        'GAP 2 mm,0 mm',
        'CODEPAGE 1252',
        'CLS',
        'TEXT 74,12,"8",0,1,1,"Savon de Marseille"',
        'BARCODE 105,141,"EAN13",65,1,0,2,2,"400638133393"',
        'TEXT 60,54,"8",0,2,2,"12 500 GNF"',
        'PRINT 1,2',
        '',
      ].join('\r\n'),
    )
    expect(job).toMatchObject({ language: 'TSPL', encoding: 'windows-1252', labelCount: 2, issues: [] })
  })

  it('ZPL — rouleau 50 × 30, EAN-13, 2 exemplaires', () => {
    const job = buildLabelCommands([label({ copies: 2 })], roll('ZPL'))
    expect(job.payload).toBe(
      [
        '^XA',
        '^CI28',
        '^PW400',
        '^LL240',
        '^LH0,0',
        '^FO12,12^A0N,29,29^FB376,1,0,C,0^FH_^FDSavon de Marseille^FS',
        '^BY2,3,65',
        '^FO105,141^BEN,65,Y,N^FD400638133393^FS',
        '^FO12,54^A0N,61,61^FB376,1,0,C,0^FH_^FD12 500 GNF^FS',
        '^PQ2,0,1,N',
        '^XZ',
        '',
      ].join('\r\n'),
    )
    expect(job).toMatchObject({ language: 'ZPL', encoding: 'utf-8', labelCount: 2 })
  })
})

describe('structure du travail', () => {
  it('TSPL : SIZE/GAP/CODEPAGE une fois, puis CLS…PRINT par article avec ses copies', () => {
    const job = buildLabelCommands([label({ productId: 'a', copies: 3 }), label({ productId: 'b', barcode: '5901234123457', copies: 5 })], roll('TSPL', 'roll-50x30', { gapMm: 3 }))
    const lines = job.payload.split('\r\n')
    expect(lines.slice(0, 3)).toEqual(['SIZE 50 mm,30 mm', 'GAP 3 mm,0 mm', 'CODEPAGE 1252'])
    expect(lines.filter((l) => l === 'CLS')).toHaveLength(2)
    expect(lines.filter((l) => l.startsWith('PRINT'))).toEqual(['PRINT 1,3', 'PRINT 1,5'])
    expect(job.labelCount).toBe(8)
  })

  it('ZPL : un bloc ^XA…^XZ par article, avec ^PQ = copies', () => {
    const job = buildLabelCommands([label({ productId: 'a', copies: 3 }), label({ productId: 'b', barcode: '5901234123457', copies: 5 })], roll('ZPL'))
    const lines = job.payload.split('\r\n')
    expect(lines.filter((l) => l === '^XA')).toHaveLength(2)
    expect(lines.filter((l) => l === '^XZ')).toHaveLength(2)
    expect(lines.filter((l) => l.startsWith('^PQ'))).toEqual(['^PQ3,0,1,N', '^PQ5,0,1,N'])
  })

  it('rouleau 40 × 30 : dimensions reprises dans SIZE et ^PW/^LL', () => {
    expect(buildLabelCommands([label()], roll('TSPL', 'roll-40x30')).payload).toContain('SIZE 40 mm,30 mm')
    const zpl = buildLabelCommands([label()], roll('ZPL', 'roll-40x30')).payload
    expect(zpl).toContain('^PW320')
    expect(zpl).toContain('^LL240')
  })

  it('résolution 300 dpi : les dimensions en points suivent', () => {
    const zpl = buildLabelCommands([label()], roll('ZPL', 'roll-50x30', { dpi: 300 })).payload
    expect(zpl).toContain('^PW591')
    expect(zpl).toContain('^LL354')
  })

  it('EAN-13 : 12 chiffres envoyés (l’imprimante calcule la clé) ; Code 128 : valeur complète', () => {
    expect(buildLabelCommands([label()], roll('TSPL')).payload).toContain('"EAN13",65,1,0,2,2,"400638133393"')
    expect(buildLabelCommands([label({ barcode: 'REF-42/B' })], roll('TSPL')).payload).toMatch(/BARCODE \d+,\d+,"128",\d+,1,0,\d+,\d+,"REF-42\/B"/)
    expect(buildLabelCommands([label()], roll('ZPL')).payload).toContain('^BEN,65,Y,N^FD400638133393^FS')
    expect(buildLabelCommands([label({ barcode: 'REF-42/B' })], roll('ZPL')).payload).toContain('^BCN,')
  })

  it('largeur de barre = nombre entier de points de l’imprimante (aucun arrondi côté imprimante)', () => {
    for (const dpi of [203, 300]) {
      const { plan } = planOf(label(), roll('TSPL', 'roll-50x30', { dpi }))
      const barcode = plan.primitives.find((p): p is Extract<Primitive, { kind: 'barcode' }> => p.kind === 'barcode')!
      expect(Number.isInteger(barcode.module)).toBe(true)
      expect(barcode.module).toBeGreaterThanOrEqual(1)
      expect(barcode.width).toBe(95 * barcode.module) // EAN-13 : 95 modules
    }
  })

  it('article sans code-barres : étiquette de prix seule, aucun BARCODE', () => {
    for (const language of ['TSPL', 'ZPL'] as const) {
      const job = buildLabelCommands([label({ barcode: null })], roll(language))
      expect(job.payload).not.toMatch(/BARCODE|\^BE|\^BC/)
      expect(job.issues).toEqual([{ productId: 'p1', kind: 'NO_BARCODE' }])
    }
  })

  it('prix promo : ancien prix + trait qui le barre', () => {
    const tspl = buildLabelCommands([label({ price: 9000, previousPrice: 12000 })], roll('TSPL')).payload
    expect(tspl).toMatch(/BAR \d+,\d+,\d+,\d+/)
    expect(tspl).toContain('"12 000 GNF"')
    expect(tspl).toContain('"9 000 GNF"')
    expect(buildLabelCommands([label({ price: 9000, previousPrice: 12000 })], roll('ZPL')).payload).toMatch(/\^GB\d+,\d+,\d+\^FS/)
    expect(buildLabelCommands([label()], roll('TSPL')).payload).not.toMatch(/^BAR /m)
  })

  it('boutique et catégorie seulement si demandées', () => {
    const off = buildLabelCommands([label({ categoryName: 'Hygiène' })], roll('TSPL'), { shopName: 'Chez Fatou' }).payload
    expect(off).not.toContain('Chez Fatou')
    expect(off).not.toContain('Hygiène')
    const on = buildLabelCommands([label({ categoryName: 'Hygiène' })], roll('TSPL'), { showShopName: true, shopName: 'Chez Fatou', showCategory: true }).payload
    expect(on).toContain('"Chez Fatou"')
    expect(on).toContain('"Hygiène"')
  })

  it('décalage du profil : déplace toute la mise en page (jamais en coordonnées négatives)', () => {
    const base = planOf(label(), roll('TSPL')).plan.primitives
    const shifted = planOf(label(), roll('TSPL', 'roll-50x30', { offsetXMm: 1, offsetYMm: 0.5 })).plan.primitives
    const dx = Math.round((1 * 203) / 25.4)
    const dy = Math.round((0.5 * 203) / 25.4)
    shifted.forEach((p, i) => {
      expect(p.x).toBe(base[i].x + dx)
      expect(p.y).toBe(base[i].y + dy)
    })
    const negative = planOf(label(), roll('TSPL', 'roll-50x30', { offsetXMm: -20, offsetYMm: -20 })).plan.primitives
    for (const p of negative) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('mise en page — tout reste dans l’étiquette', () => {
  const models: Record<string, LabelModel> = {
    standard: label(),
    promo: label({ name: 'Huile de palme rouge artisanale bouteille 1 litre', price: 28000, previousPrice: 35000, categoryName: 'Alimentation', barcode: '5901234123457' }),
    'code 128': label({ barcode: 'REF-42/B' }),
    'nom très long': label({ name: 'Crème hydratante visage et corps à l’huile de karité bio 250 ml édition limitée' }),
    'prix énorme': label({ price: 123456789 }),
    'sans code': label({ barcode: null }),
  }

  const cases = ROLL_PRESETS.flatMap((preset) => [203, 300].map((dpi) => ({ presetId: preset.id, dpi })))

  it.each(cases)('$presetId à $dpi dpi : aucune primitive ne déborde', ({ presetId, dpi }) => {
    for (const [name, model] of Object.entries(models)) {
      const profile = roll('ZPL', presetId, { dpi })
      const { plan } = planOf(model, profile, { showShopName: true, shopName: 'Chez Fatou', showCategory: true })
      for (const p of plan.primitives) {
        const right = p.x + p.width
        const bottom = p.kind === 'bar' || p.kind === 'barcode' ? p.y + p.height : p.y + p.fontDots
        expect(p.x, `${name} x`).toBeGreaterThanOrEqual(0)
        expect(p.y, `${name} y`).toBeGreaterThanOrEqual(0)
        expect(right, `${name} droite (${p.kind})`).toBeLessThanOrEqual(plan.widthDots)
        expect(bottom, `${name} bas (${p.kind})`).toBeLessThanOrEqual(plan.heightDots + 1)
      }
    }
  })

  it('les blocs ne se chevauchent pas verticalement (nom < prix < code-barres)', () => {
    const { plan } = planOf(models.standard, roll('ZPL'))
    const text = plan.primitives.filter((p): p is Extract<Primitive, { kind: 'text' }> => p.kind === 'text')
    const barcode = plan.primitives.find((p) => p.kind === 'barcode')!
    const [name, price] = text
    expect(name.y + name.fontDots).toBeLessThanOrEqual(price.y)
    expect(price.y + price.fontDots).toBeLessThanOrEqual(barcode.y)
  })
})

describe('polices bitmap TSPL', () => {
  it('wrapText : coupe aux espaces, respecte le nombre de lignes, refuse un mot trop long', () => {
    expect(wrapText('Savon de Marseille', 20, 2)).toEqual(['Savon de Marseille'])
    expect(wrapText('Savon de Marseille', 10, 2)).toEqual(['Savon de', 'Marseille'])
    expect(wrapText('un deux trois quatre cinq', 8, 2)).toBeNull()
    expect(wrapText('anticonstitutionnellement', 10, 3)).toBeNull()
    expect(wrapText('x', 0, 1)).toBeNull()
  })

  it('chooseBitmapFont : la plus grande case qui tient — et jamais plus large que la boîte', () => {
    for (const [text, fontDots, box, lines] of [['12 500 GNF', 61, 376, 1], ['Savon de Marseille', 29, 376, 2], ['1 250 000 GNF', 61, 300, 1], ['Nom', 200, 376, 1]] as const) {
      const choice = chooseBitmapFont(text, fontDots, box, lines)
      expect(choice.lines.length).toBeLessThanOrEqual(lines)
      for (const line of choice.lines) expect(line.length * choice.cellW).toBeLessThanOrEqual(box)
      expect(choice.cellH).toBeLessThanOrEqual(Math.max(12, Math.round(fontDots * 0.85)))
    }
    // plus de place → plus grand
    expect(chooseBitmapFont('12', 61, 376, 1).cellH).toBeGreaterThanOrEqual(chooseBitmapFont('12 500 000 GNF', 61, 376, 1).cellH)
  })

  it('texte impossible à faire tenir : tronqué avec la plus petite police, sans lever', () => {
    const choice = chooseBitmapFont('x'.repeat(500), 30, 100, 2)
    expect(choice.lines.length).toBeLessThanOrEqual(2)
    for (const line of choice.lines) expect(line.length * choice.cellW).toBeLessThanOrEqual(100)
  })
})

describe('encodage et échappements', () => {
  it('TSPL : Windows-1252 (accents, €, apostrophe typographique) ; inconnu → « ? »', () => {
    const bytes = Array.from(encodePayload('é è à ç ô €’œ中', 'windows-1252'))
    expect(bytes).toEqual([0xe9, 0x20, 0xe8, 0x20, 0xe0, 0x20, 0xe7, 0x20, 0xf4, 0x20, 0x80, 0x92, 0x9c, 0x3f])
    expect(Array.from(encodePayload('ABC 123\r\n', 'windows-1252'))).toEqual([0x41, 0x42, 0x43, 0x20, 0x31, 0x32, 0x33, 0x0d, 0x0a])
  })

  it('ZPL : UTF-8', () => {
    expect(Array.from(encodePayload('é', 'utf-8'))).toEqual([0xc3, 0xa9])
  })

  it('les accents d’un nom sortent bien encodés dans le travail TSPL', () => {
    const job = buildLabelCommands([label({ name: 'Café crème' })], roll('TSPL'))
    const bytes = encodePayload(job.payload, job.encoding)
    expect(bytes).toContain(0xe9) // é
    expect(bytes).not.toContain(0x3f) // aucun caractère perdu
  })

  it('TSPL : guillemets et antislash ne cassent pas la chaîne', () => {
    const payload = buildLabelCommands([label({ name: 'Vin "Rouge" 12\\75' })], roll('TSPL')).payload
    expect(payload).toContain('\\["]Rouge\\["]')
    expect(payload).not.toContain('\\75')
    expect(payload).toContain('12/75')
  })

  it('ZPL : ^ ~ _ échappés (sinon ils ouvriraient une commande)', () => {
    const payload = buildLabelCommands([label({ name: 'Bio^Nature~2_en_1' })], roll('ZPL')).payload
    expect(payload).toContain('Bio_5ENature_7E2_5Fen_5F1')
    const dataFields = payload.split('\r\n').filter((l) => l.includes('^FD'))
    for (const field of dataFields) {
      const data = field.slice(field.indexOf('^FD') + 3, field.lastIndexOf('^FS'))
      expect(data).not.toMatch(/[\^~]/)
    }
  })

  it('un nom sur plusieurs lignes ou avec espaces bizarres est normalisé', () => {
    const payload = buildLabelCommands([label({ name: '  Savon\n  de Marseille  ' })], roll('TSPL')).payload
    expect(payload).toContain('"Savon de Marseille"')
  })
})

describe('erreurs et avertissements', () => {
  it('planche A4 : refusée (envoi direct = rouleau seulement)', () => {
    const sheet = createPrintProfile({ id: 's', name: 's', kind: 'SHEET_A4' })
    expect(() => buildLabelCommands([label()], sheet)).toThrow(LabelCommandsError)
    try {
      buildLabelCommands([label()], sheet)
    } catch (error) {
      expect((error as LabelCommandsError).code).toBe('NOT_A_ROLL')
    }
  })

  it('langage HTML (dialogue système) : refusé', () => {
    const profile = createPrintProfile({ id: 'r', name: 'r', kind: 'THERMAL_ROLL' })
    try {
      buildLabelCommands([label()], profile)
      throw new Error('aurait dû lever')
    } catch (error) {
      expect(error).toBeInstanceOf(LabelCommandsError)
      expect((error as LabelCommandsError).code).toBe('NOT_A_PRINTER_LANGUAGE')
    }
  })

  it('travail démesuré : refusé', () => {
    try {
      buildLabelCommands([label({ copies: 2001 })], roll('TSPL'))
      throw new Error('aurait dû lever')
    } catch (error) {
      expect((error as LabelCommandsError).code).toBe('TOO_MANY_LABELS')
    }
  })

  it('mêmes avertissements que le rendu HTML (sans code, doublon, code non imprimable, prix invalide, 0 copie)', () => {
    const models = [
      label({ productId: 'a', barcode: null }),
      label({ productId: 'b', barcode: '4006381333931' }),
      label({ productId: 'c', barcode: '4006381333931' }),
      label({ productId: 'd', barcode: 'éàü' }),
      label({ productId: 'e', price: Number.NaN }),
      label({ productId: 'f', copies: 0 }),
    ]
    const profile = roll('TSPL')
    const kinds = (issues: { productId: string; kind: string }[]) => issues.map((i) => `${i.productId}:${i.kind}`).sort()
    expect(kinds(buildLabelCommands(models, profile).issues)).toEqual(kinds(buildLabelsDocument(models, profile).issues))
  })

  it('l’étiquette sans copie est ignorée', () => {
    const job = buildLabelCommands([label({ copies: 0 }), label({ productId: 'b', barcode: '5901234123457' })], roll('ZPL'))
    expect(job.labelCount).toBe(1)
    expect(job.payload.match(/\^XA/g)).toHaveLength(1)
  })
})

describe('étiquette d’essai', () => {
  it('une étiquette avec le code interne d’essai, dans les deux langages', () => {
    for (const language of ['TSPL', 'ZPL'] as const) {
      const job = buildTestCommands(roll(language))
      expect(job.labelCount).toBe(1)
      expect(job.payload).toContain('200000000000')
      expect(job.issues).toEqual([])
    }
  })

  it('nom d’exemple personnalisable (traduction)', () => {
    expect(buildTestCommands(roll('TSPL'), { sampleName: 'Test label' }).payload).toContain('"Test label"')
  })
})
