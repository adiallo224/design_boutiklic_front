import { describe, expect, it } from 'vitest'
import { MAX_LABELS_PER_JOB, buildLabelsDocument } from '@boutiklic/shared/src/labels/buildLabelsDocument'
import { gridLayout } from '@boutiklic/shared/src/labels/layouts'
import { createPrintProfile } from '@boutiklic/shared/src/labels/profile'
import type { LabelModel, PrintProfile } from '@boutiklic/shared/src/labels/types'

const EAN = '4006381333931'
const EAN_2 = '5901234123457'

function label(overrides: Partial<LabelModel> = {}): LabelModel {
  return { productId: 'p1', name: 'Savon de Marseille', price: 12500, currency: 'GNF', barcode: EAN, copies: 1, ...overrides }
}

const a4 = (presetId: string): PrintProfile => createPrintProfile({ id: presetId, name: presetId, kind: 'SHEET_A4', presetId })
const roll = (): PrintProfile => createPrintProfile({ id: 'roll', name: 'Rouleau', kind: 'THERMAL_ROLL' })

const count = (html: string, needle: string) => html.split(needle).length - 1

describe('pagination', () => {
  it('25 étiquettes sur des pages de 8 → 4 pages', () => {
    const doc = buildLabelsDocument([label({ copies: 25 })], a4('std-8'))
    expect(doc.labelCount).toBe(25)
    expect(doc.pageCount).toBe(4)
    expect(count(doc.html, '<section class="page">')).toBe(4)
    expect(count(doc.html, 'class="cell')).toBe(25)
  })

  it('exactement une page pleine → 1 page', () => {
    expect(buildLabelsDocument([label({ copies: 24 })], a4('small-24')).pageCount).toBe(1)
    expect(buildLabelsDocument([label({ copies: 25 })], a4('small-24')).pageCount).toBe(2)
  })

  it('additionne les copies de plusieurs articles', () => {
    const doc = buildLabelsDocument([label({ productId: 'a', copies: 3 }), label({ productId: 'b', copies: 2 })], a4('a6'))
    expect(doc.labelCount).toBe(5)
    expect(doc.pageCount).toBe(2) // 4 par page
  })

  it('« commencer à la 7ᵉ case » laisse 6 cases vides sur la 1ʳᵉ page', () => {
    const doc = buildLabelsDocument([label({ copies: 20 })], a4('small-24'), { startIndex: 6 })
    expect(doc.labelCount).toBe(20)
    expect(doc.pageCount).toBe(2) // 6 + 20 = 26 cases → 24 + 2
    const firstPage = doc.html.split('<section class="page">')[1]
    expect(count(firstPage, 'class="cell')).toBe(18) // 24 - 6 vides
  })

  it('aucune étiquette → aucune page', () => {
    const doc = buildLabelsDocument([], a4('small-24'))
    expect(doc.pageCount).toBe(0)
    expect(doc.labelCount).toBe(0)
  })

  it('rouleau thermique : une étiquette par page', () => {
    const doc = buildLabelsDocument([label({ copies: 3 })], roll())
    expect(doc.pageCount).toBe(3)
  })

  it('refuse un travail démesuré', () => {
    expect(() => buildLabelsDocument([label({ copies: MAX_LABELS_PER_JOB + 1 })], a4('small-24'))).toThrow(RangeError)
    expect(() => buildLabelsDocument([label({ copies: MAX_LABELS_PER_JOB })], a4('small-24'))).not.toThrow()
  })
})

describe('taille de page et positions', () => {
  it('A4 : @page 210 × 297 mm sans marge', () => {
    const { html } = buildLabelsDocument([label()], a4('std-8'))
    expect(html).toContain('@page{size:210mm 297mm;margin:0}')
  })

  it('rouleau 50 × 30 : @page à la taille de l’étiquette', () => {
    const { html } = buildLabelsDocument([label()], roll())
    expect(html).toContain('@page{size:50mm 30mm;margin:0}')
  })

  it('positionne les cases en grille (colonne puis ligne)', () => {
    const { html } = buildLabelsDocument([label({ copies: 3 })], a4('std-8'))
    expect(html).toContain('left:0mm;top:0mm;width:105mm;height:74.25mm')
    expect(html).toContain('left:105mm;top:0mm;')
    expect(html).toContain('left:0mm;top:74.25mm;')
  })

  it('applique le décalage X/Y du profil à toute la grille', () => {
    const profile = { ...a4('std-8'), offsetXMm: 1.5, offsetYMm: -2 }
    const { html } = buildLabelsDocument([label()], profile)
    expect(html).toContain('left:1.5mm;top:-2mm;')
  })

  it('respecte marges et gouttières d’un format personnalisé', () => {
    const layout = { ...gridLayout(2, 2), cellWidthMm: 90, cellHeightMm: 60, marginLeftMm: 10, marginTopMm: 12, gutterXMm: 5, gutterYMm: 4, paddingMm: 3 }
    const profile = createPrintProfile({ id: 'c', name: 'c', kind: 'SHEET_A4', layout })
    const { html } = buildLabelsDocument([label({ copies: 4 })], profile)
    expect(html).toContain('left:10mm;top:12mm;')
    expect(html).toContain('left:105mm;top:12mm;') // 10 + 90 + 5
    expect(html).toContain('left:10mm;top:76mm;') // 12 + 60 + 4
  })

  it('traits de coupe optionnels', () => {
    expect(buildLabelsDocument([label()], a4('std-8')).html).not.toContain('class="cell cut"')
    expect(buildLabelsDocument([label()], a4('std-8'), { showCutMarks: true }).html).toContain('class="cell cut"')
  })
})

describe('contenu de l’étiquette', () => {
  it('affiche nom, prix TTC avec devise et code-barres (SVG + chiffres lisibles)', () => {
    const { html } = buildLabelsDocument([label()], a4('std-8'))
    expect(html).toContain('Savon de Marseille')
    expect(html.replace(/ /g, ' ')).toMatch(/12\s500 GNF/)
    expect(html).toContain('<svg')
    expect(html).toContain('4 006381 333931')
  })

  it('échappe le HTML du nom (pas d’injection)', () => {
    const { html } = buildLabelsDocument([label({ name: '<script>alert(1)</script> & "x"' })], a4('std-8'))
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&amp;')
    expect(html).toContain('&quot;x&quot;')
  })

  it('promo : ancien prix barré + nouveau prix', () => {
    const { html } = buildLabelsDocument([label({ price: 9000, previousPrice: 12000 })], a4('std-8'))
    expect(html).toContain('class="o"')
    expect(html.replace(/ /g, ' ')).toMatch(/12\s000 GNF/)
    expect(html.replace(/ /g, ' ')).toMatch(/9\s000 GNF/)
  })

  it('pas d’ancien prix si celui-ci n’est pas supérieur', () => {
    expect(buildLabelsDocument([label({ price: 9000, previousPrice: 9000 })], a4('std-8')).html).not.toContain('class="o"')
    expect(buildLabelsDocument([label({ price: 9000, previousPrice: null })], a4('std-8')).html).not.toContain('class="o"')
  })

  it('affiche les décimales seulement si le prix n’est pas entier', () => {
    const { html } = buildLabelsDocument([label({ price: 12.5, currency: 'SLE' })], a4('std-8'))
    expect(html).toMatch(/12,50 SLE/)
  })

  it('nom de la boutique et catégorie seulement si demandés', () => {
    const l = label({ categoryName: 'Hygiène' })
    const off = buildLabelsDocument([l], a4('std-8'), { shopName: 'Chez Fatou' }).html
    expect(off).not.toContain('Chez Fatou')
    expect(off).not.toContain('Hygiène')
    const on = buildLabelsDocument([l], a4('std-8'), { showShopName: true, shopName: 'Chez Fatou', showCategory: true }).html
    expect(on).toContain('Chez Fatou')
    expect(on).toContain('Hygiène')
  })

  it('sans code-barres demandé : pas de SVG', () => {
    expect(buildLabelsDocument([label()], a4('std-8'), { showBarcode: false }).html).not.toContain('<svg')
  })

  it('réutilise le même SVG pour un même code (pas de recalcul par copie)', () => {
    const { html } = buildLabelsDocument([label({ copies: 5 })], a4('std-8'))
    expect(count(html, '<svg')).toBe(5)
  })

  it('un code Code 128 (non EAN) est imprimé avec son texte', () => {
    const { html } = buildLabelsDocument([label({ barcode: 'REF-42/B' })], a4('std-8'))
    expect(html).toContain('REF-42/B')
    expect(html).toContain('<svg')
  })
})

describe('adaptation au format', () => {
  it('le prix géant d’un A4 complet est bien plus grand que celui d’un petit format', () => {
    const fontMm = (html: string) => Number(/class="p" style="font-size:([\d.]+)mm"/.exec(html)![1])
    const big = fontMm(buildLabelsDocument([label({ price: 12500 })], a4('a4-full')).html)
    const small = fontMm(buildLabelsDocument([label({ price: 12500 })], a4('small-24')).html)
    expect(big).toBeGreaterThan(small * 3)
  })

  it('un prix long est réduit pour tenir dans la largeur utile', () => {
    const fontMm = (html: string) => Number(/class="p" style="font-size:([\d.]+)mm"/.exec(html)![1])
    const short = fontMm(buildLabelsDocument([label({ price: 500 })], roll()).html)
    const long = fontMm(buildLabelsDocument([label({ price: 12500000 })], roll()).html)
    expect(long).toBeLessThan(short)
  })

  it('la largeur du code-barres tient dans la case (largeur utile)', () => {
    for (const id of ['a4-full', 'a5', 'a6', 'std-8', 'std-12', 'small-21', 'small-24']) {
      const profile = a4(id)
      const { html } = buildLabelsDocument([label()], profile)
      const width = Number(/<svg[^>]*width="([\d.]+)mm"/.exec(html)![1])
      expect(width, id).toBeLessThanOrEqual(profile.layout.cellWidthMm - 2 * profile.layout.paddingMm + 1e-6)
    }
    const thermal = roll()
    const width = Number(/<svg[^>]*width="([\d.]+)mm"/.exec(buildLabelsDocument([label()], thermal).html)![1])
    expect(width).toBeLessThanOrEqual(thermal.layout.cellWidthMm - 2 * thermal.layout.paddingMm + 1e-6)
  })

  it('thermique : la largeur d’un module est un multiple entier de points (203 dpi)', () => {
    const { html } = buildLabelsDocument([label()], roll())
    const svgWidth = Number(/<svg[^>]*width="([\d.]+)mm"/.exec(html)![1])
    const modules = Number(/viewBox="0 0 (\d+) 1"/.exec(html)![1])
    const dots = (svgWidth / modules) / (25.4 / 203)
    expect(Math.abs(dots - Math.round(dots))).toBeLessThan(0.01)
  })
})

describe('problèmes signalés (issues)', () => {
  const kinds = (doc: ReturnType<typeof buildLabelsDocument>) => doc.issues.map((i) => `${i.productId}:${i.kind}`).sort()

  it('article sans code-barres : étiquette de prix imprimée + NO_BARCODE', () => {
    const doc = buildLabelsDocument([label({ barcode: null })], a4('std-8'))
    expect(doc.labelCount).toBe(1)
    expect(doc.html).not.toContain('<svg')
    expect(kinds(doc)).toEqual(['p1:NO_BARCODE'])
  })

  it('pas de NO_BARCODE quand le code-barres n’est pas demandé', () => {
    expect(buildLabelsDocument([label({ barcode: null })], a4('std-8'), { showBarcode: false }).issues).toEqual([])
  })

  it('code non encodable : imprimé sans code + UNENCODABLE_BARCODE', () => {
    const doc = buildLabelsDocument([label({ barcode: 'éàü' })], a4('std-8'))
    expect(doc.html).not.toContain('<svg')
    expect(doc.issues).toEqual([{ productId: 'p1', kind: 'UNENCODABLE_BARCODE', barcode: 'éàü' }])
  })

  it('doublon de code entre articles distincts', () => {
    const doc = buildLabelsDocument([label({ productId: 'a' }), label({ productId: 'b' })], a4('std-8'))
    expect(kinds(doc)).toEqual(['a:DUPLICATE_BARCODE', 'b:DUPLICATE_BARCODE'])
  })

  it('le même article en plusieurs copies n’est pas un doublon', () => {
    expect(buildLabelsDocument([label({ copies: 3 })], a4('std-8')).issues).toEqual([])
  })

  it('codes différents : aucun doublon', () => {
    const doc = buildLabelsDocument([label({ productId: 'a' }), label({ productId: 'b', barcode: EAN_2 })], a4('std-8'))
    expect(doc.issues).toEqual([])
  })

  it('zéro exemplaire : ignoré + NO_COPIES', () => {
    const doc = buildLabelsDocument([label({ copies: 0 }), label({ productId: 'b', barcode: EAN_2, copies: 1 })], a4('std-8'))
    expect(doc.labelCount).toBe(1)
    expect(kinds(doc)).toEqual(['p1:NO_COPIES'])
  })

  it('prix invalide : affiché « — » + INVALID_PRICE', () => {
    const doc = buildLabelsDocument([label({ price: Number.NaN })], a4('std-8'))
    expect(doc.html).toContain('—')
    expect(kinds(doc)).toEqual(['p1:INVALID_PRICE'])
  })

  it('code très long dans une petite case : BARCODE_TOO_SMALL (barres trop fines pour un scan fiable)', () => {
    const long = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789abcdefghij' // 46 caractères
    const doc = buildLabelsDocument([label({ barcode: long })], a4('small-24'))
    expect(doc.issues.some((i) => i.kind === 'BARCODE_TOO_SMALL')).toBe(true)
    expect(doc.labelCount).toBe(1) // toujours imprimé
  })

  it('rouleau 40 × 30 à 203 dpi : un code court garde 2 points par module (pas de faux BARCODE_TOO_SMALL)', () => {
    const small = createPrintProfile({ id: 'r', name: 'r', kind: 'THERMAL_ROLL', presetId: 'roll-40x30' })
    const doc = buildLabelsDocument([label({ barcode: 'REF-42/B' })], small)
    expect(doc.issues).toEqual([])
    const svgWidth = Number(/<svg[^>]*width="([\d.]+)mm"/.exec(doc.html)![1])
    const modules = Number(/viewBox="0 0 (\d+) 1"/.exec(doc.html)![1])
    expect(svgWidth / modules).toBeGreaterThanOrEqual(0.19)
    expect(svgWidth).toBeLessThanOrEqual(small.layout.cellWidthMm - 2 * small.layout.paddingMm + 1e-6)
  })

  it('un EAN-13 standard tient lisiblement dans tous les formats (aucun BARCODE_TOO_SMALL)', () => {
    for (const id of ['a4-full', 'a5', 'a6', 'std-8', 'std-10', 'std-12', 'small-21', 'small-24']) {
      expect(buildLabelsDocument([label()], a4(id)).issues, id).toEqual([])
    }
    expect(buildLabelsDocument([label()], roll()).issues).toEqual([])
  })
})

describe('document', () => {
  it('est un document HTML complet avec titre', () => {
    const { html } = buildLabelsDocument([label()], a4('std-8'), { title: 'Arrivage <mars>', locale: 'en' })
    expect(html.startsWith('<!doctype html>')).toBe(true)
    expect(html).toContain('<html lang="en">')
    expect(html).toContain('<title>Arrivage &lt;mars&gt;</title>')
    expect(html).toContain('</html>')
  })
})
