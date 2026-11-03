import { LINE, MAX_LABELS_PER_JOB, TIERS, computeLabelMetrics, findDuplicateBarcodes, type LabelMetrics, type RenderContext } from './buildLabelsDocument'
import { withEan13CheckDigit } from './ean13'
import { tierForLayout } from './layouts'
import { DEFAULT_CONTENT_OPTIONS, type BarcodeSymbology, type LabelContentOptions, type LabelIssue, type LabelModel, type PrintProfile } from './types'

/**
 * Moteur « commandes d'imprimante » (cf. étude §3.4, phase 6) : au lieu d'un document HTML passé par le pilote,
 * on envoie directement à une imprimante d'étiquettes son langage natif — **TSPL** (TSC et la plupart des
 * imprimantes génériques) ou **ZPL** (Zebra). Le code-barres est alors dessiné par l'imprimante elle-même
 * (net, calé sur ses points), et il n'y a plus de boîte de dialogue.
 *
 * ⚠️ Non validé sur du matériel réel : les tailles, positions et commandes suivent les manuels TSPL2/ZPL II et le
 * rendu ZPL a été comparé à un moteur de rendu externe ; un essai sur l'imprimante réelle (page d'essai) reste
 * indispensable, notamment le sens d'impression, la détection des étiquettes et l'intervalle (`gapMm`).
 *
 * Architecture : un PLAN neutre (primitives positionnées en points de l'imprimante, indépendant du langage), puis un
 * émetteur par langage. Les tailles de texte, le budget vertical et la largeur des barres viennent des mêmes
 * métriques que le rendu HTML (`computeLabelMetrics`) : l'aperçu à l'écran reste représentatif.
 */

export type CommandLanguage = 'TSPL' | 'ZPL'
export type PayloadEncoding = 'windows-1252' | 'utf-8'

export interface LabelCommandsJob {
  language: CommandLanguage
  /** Commandes, lignes séparées par CRLF. Texte : à encoder avec `encodePayload` avant envoi. */
  payload: string
  encoding: PayloadEncoding
  /** Nombre d'étiquettes physiques (copies comprises). */
  labelCount: number
  issues: LabelIssue[]
}

export type LabelCommandsErrorCode = 'NOT_A_ROLL' | 'NOT_A_PRINTER_LANGUAGE' | 'TOO_MANY_LABELS'

export class LabelCommandsError extends Error {
  constructor(
    message: string,
    readonly code: LabelCommandsErrorCode,
  ) {
    super(message)
    this.name = 'LabelCommandsError'
  }
}

// ------------------------------------------------------------------------------------------------ plan

export type Primitive =
  | { kind: 'text'; x: number; y: number; width: number; fontDots: number; maxLines: number; text: string }
  | { kind: 'bar'; x: number; y: number; width: number; height: number }
  | { kind: 'barcode'; symbology: BarcodeSymbology; value: string; x: number; y: number; width: number; height: number; module: number }

export interface LabelPlan {
  widthDots: number
  heightDots: number
  primitives: Primitive[]
}

const PRICE_CHAR_RATIO = 0.62
const dotsOf = (mm: number, dpi: number) => Math.round((mm * dpi) / 25.4)

/** Suite de caractères sûre pour un texte d'imprimante : une seule ligne, espaces normalisés (espace insécable compris). */
function cleanText(text: string): string {
  return text.replace(/[\s  ]+/g, ' ').trim()
}

/** Plan d'une étiquette : positions en points, origine en haut à gauche de l'étiquette (décalage du profil compris). */
export function planLabel(m: LabelMetrics, profile: PrintProfile): LabelPlan {
  const { layout, dpi } = profile
  const d = (mm: number) => dotsOf(mm, dpi)
  const widthDots = d(layout.cellWidthMm)
  const heightDots = d(layout.cellHeightMm)
  const originX = Math.max(0, d(layout.paddingMm + profile.offsetXMm))
  const originY = Math.max(0, d(layout.paddingMm + profile.offsetYMm))
  const usableWDots = d(m.usableW)
  const primitives: Primitive[] = []

  // --- bloc du haut : boutique, nom, catégorie ---
  let y = 0
  const pushText = (text: string, fontMm: number, maxLines: number, atMm: number) =>
    primitives.push({ kind: 'text', x: originX, y: originY + d(atMm), width: usableWDots, fontDots: d(fontMm), maxLines, text: cleanText(text) })
  if (m.shopName) {
    pushText(m.shopName, m.small, 1, y)
    y += m.small * LINE
  }
  if (m.name) {
    pushText(m.name, m.nameFont, m.nameLines, y)
    y += m.nameLines * m.nameFont * LINE
  }
  if (m.category) {
    pushText(m.category, m.small, 1, y)
    y += m.small * LINE
  }
  const topHeight = y

  // --- bloc du bas : code-barres (barres puis chiffres lisibles dessinés par l'imprimante) ---
  const barcodeBlock = m.encoding ? m.barHeight + m.digitsFont * LINE + m.gap : 0
  if (m.encoding) {
    const moduleDots = Math.max(1, d(m.moduleWidth))
    const widthOfBars = m.encoding.modules.length * moduleDots
    primitives.push({
      kind: 'barcode',
      symbology: m.encoding.symbology,
      value: m.encoding.value,
      x: originX + Math.max(0, Math.round((usableWDots - widthOfBars) / 2)),
      y: originY + d(m.usableH - barcodeBlock + m.gap),
      width: widthOfBars,
      height: Math.max(1, d(m.barHeight)),
      module: moduleDots,
    })
  }

  // --- bloc du milieu : ancien prix barré + prix, centrés dans l'espace restant ---
  const midHeight = (m.hasPrevious ? m.previousFont * LINE : 0) + m.priceFont * LINE
  const available = m.usableH - barcodeBlock - topHeight
  let yMid = topHeight + Math.max(0, (available - midHeight) / 2)
  if (m.hasPrevious) {
    pushText(m.previousText, m.previousFont, 1, yMid)
    const textWidth = Math.min(usableWDots, Math.round(cleanText(m.previousText).length * PRICE_CHAR_RATIO * d(m.previousFont)))
    primitives.push({
      kind: 'bar',
      x: originX + Math.round((usableWDots - textWidth) / 2),
      // Milieu du glyphe (≈ 0,42 em sous le haut de la ligne), pas milieu de la boîte de ligne : sinon le trait passe au-dessus du texte.
      y: originY + d(yMid) + Math.round(d(m.previousFont) * 0.42),
      width: textWidth,
      height: Math.max(1, d(0.2)),
    })
    yMid += m.previousFont * LINE
  }
  pushText(m.priceText, m.priceFont, 1, yMid)

  return { widthDots, heightDots, primitives }
}

// ------------------------------------------------------------------------------------------------ textes

/** Polices bitmap intégrées des imprimantes TSPL (largeur × hauteur d'une case, en points) — TSPL2 « TEXT ». */
const TSPL_FONTS: readonly { id: string; w: number; h: number }[] = [
  { id: '1', w: 8, h: 12 },
  { id: '2', w: 12, h: 20 },
  { id: '3', w: 16, h: 24 },
  { id: '4', w: 24, h: 32 },
  { id: '5', w: 32, h: 48 },
  { id: '6', w: 14, h: 19 },
  { id: '7', w: 21, h: 27 },
  { id: '8', w: 14, h: 25 },
]
const TSPL_MAX_MULTIPLIER = 10
/** Hauteur d'une case bitmap ≈ 0,85 × la « taille de police » (em) du rendu HTML (la hauteur de capitale est plus basse que l'em). */
const CELL_TO_EM = 0.85

export interface BitmapChoice {
  font: string
  multiplier: number
  cellW: number
  cellH: number
  lines: string[]
}

/** Coupe `text` en au plus `maxLines` lignes de `perLine` caractères (aux espaces) ; `null` si ça ne tient pas. */
export function wrapText(text: string, perLine: number, maxLines: number): string[] | null {
  if (perLine < 1) return null
  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    if (word.length > perLine) return null
    const candidate = current === '' ? word : `${current} ${word}`
    if (candidate.length <= perLine) current = candidate
    else {
      lines.push(current)
      current = word
    }
  }
  if (current !== '') lines.push(current)
  return lines.length <= maxLines ? lines : null
}

/**
 * Choisit (police, multiplicateur) bitmap : la PLUS GRANDE case dont la hauteur reste ≤ celle demandée et dont le
 * texte tient dans `maxLines` lignes de la largeur de boîte. Si rien ne tient, la plus petite police, texte tronqué.
 */
export function chooseBitmapFont(text: string, fontDots: number, boxWidth: number, maxLines: number): BitmapChoice {
  const targetH = Math.max(1, Math.round(fontDots * CELL_TO_EM))
  const candidates: { font: string; multiplier: number; cellW: number; cellH: number }[] = []
  for (const f of TSPL_FONTS) {
    for (let mul = 1; mul <= TSPL_MAX_MULTIPLIER; mul++) candidates.push({ font: f.id, multiplier: mul, cellW: f.w * mul, cellH: f.h * mul })
  }
  // Plus grande hauteur d'abord, puis plus large (moins de lignes).
  candidates.sort((a, b) => b.cellH - a.cellH || b.cellW - a.cellW)

  for (const c of candidates) {
    if (c.cellH > targetH) continue
    const lines = wrapText(text, Math.floor(boxWidth / c.cellW), maxLines)
    if (lines) return { ...c, lines }
  }
  const smallest = candidates[candidates.length - 1]
  const perLine = Math.max(1, Math.floor(boxWidth / smallest.cellW))
  const lines = wrapText(text.slice(0, perLine * maxLines), perLine, maxLines) ?? [text.slice(0, perLine)]
  return { ...smallest, lines }
}

// ------------------------------------------------------------------------------------------------ encodage

const CP1252_HIGH: Record<string, number> = {
  '€': 0x80, '‚': 0x82, 'ƒ': 0x83, '„': 0x84, '…': 0x85, '†': 0x86, '‡': 0x87, 'ˆ': 0x88, '‰': 0x89, 'Š': 0x8a, '‹': 0x8b, 'Œ': 0x8c,
  'Ž': 0x8e, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, '˜': 0x98, '™': 0x99, 'š': 0x9a, '›': 0x9b,
  'œ': 0x9c, 'ž': 0x9e, 'Ÿ': 0x9f,
}

/** Octets à envoyer : Windows-1252 (TSPL, `CODEPAGE 1252`) ou UTF-8 (ZPL, `^CI28`). Caractère inconnu → « ? ». */
export function encodePayload(payload: string, encoding: PayloadEncoding): Uint8Array {
  if (encoding === 'utf-8') return new TextEncoder().encode(payload)
  const bytes: number[] = []
  for (const char of payload) {
    const code = char.codePointAt(0) as number
    if (code < 0x80 || (code >= 0xa0 && code <= 0xff)) bytes.push(code)
    else bytes.push(CP1252_HIGH[char] ?? 0x3f)
  }
  return Uint8Array.from(bytes)
}

// ------------------------------------------------------------------------------------------------ TSPL

const tsplString = (text: string) => text.replace(/\\/g, '/').replace(/"/g, '\\["]')
const mmText = (mm: number) => `${Number(mm.toFixed(1))}`

function tsplLabel(plan: LabelPlan, copies: number): string[] {
  const out: string[] = ['CLS']
  for (const p of plan.primitives) {
    if (p.kind === 'bar') {
      out.push(`BAR ${p.x},${p.y},${p.width},${p.height}`)
    } else if (p.kind === 'text') {
      const choice = chooseBitmapFont(p.text, p.fontDots, p.width, p.maxLines)
      choice.lines.forEach((line, index) => {
        const lineWidth = line.length * choice.cellW
        const x = p.x + Math.max(0, Math.round((p.width - lineWidth) / 2))
        const y = p.y + Math.round(index * choice.cellH * 1.15)
        out.push(`TEXT ${x},${y},"${choice.font}",0,${choice.multiplier},${choice.multiplier},"${tsplString(line)}"`)
      })
    } else {
      // EAN-13 : 12 chiffres, l'imprimante calcule la clé (déjà validée côté app).
      const type = p.symbology === 'EAN13' ? 'EAN13' : '128'
      const content = p.symbology === 'EAN13' ? p.value.slice(0, 12) : p.value
      out.push(`BARCODE ${p.x},${p.y},"${type}",${p.height},1,0,${p.module},${p.module},"${tsplString(content)}"`)
    }
  }
  out.push(`PRINT 1,${copies}`)
  return out
}

function tsplJob(plans: { plan: LabelPlan; copies: number }[], profile: PrintProfile): string[] {
  const { layout } = profile
  const lines = [`SIZE ${mmText(layout.cellWidthMm)} mm,${mmText(layout.cellHeightMm)} mm`, `GAP ${mmText(profile.gapMm)} mm,0 mm`, 'CODEPAGE 1252']
  for (const { plan, copies } of plans) lines.push(...tsplLabel(plan, copies))
  return lines
}

// ------------------------------------------------------------------------------------------------ ZPL

/** ^FH (indicateur « _ ») : on échappe les trois caractères qui casseraient un champ ZPL. */
const zplData = (text: string) => text.replace(/_/g, '_5F').replace(/\^/g, '_5E').replace(/~/g, '_7E')

function zplLabel(plan: LabelPlan, copies: number): string[] {
  const out: string[] = ['^XA', '^CI28', `^PW${plan.widthDots}`, `^LL${plan.heightDots}`, '^LH0,0']
  for (const p of plan.primitives) {
    if (p.kind === 'bar') {
      out.push(`^FO${p.x},${p.y}^GB${p.width},${p.height},${p.height}^FS`)
    } else if (p.kind === 'text') {
      // ^FB : bloc centré de largeur `width`, au plus `maxLines` lignes ; police 0 (mise à l'échelle) à la hauteur demandée.
      out.push(`^FO${p.x},${p.y}^A0N,${p.fontDots},${p.fontDots}^FB${p.width},${p.maxLines},0,C,0^FH_^FD${zplData(p.text)}^FS`)
    } else if (p.symbology === 'EAN13') {
      out.push(`^BY${p.module},3,${p.height}`, `^FO${p.x},${p.y}^BEN,${p.height},Y,N^FD${p.value.slice(0, 12)}^FS`)
    } else {
      out.push(`^BY${p.module},3,${p.height}`, `^FO${p.x},${p.y}^BCN,${p.height},Y,N,N,A^FH_^FD${zplData(p.value)}^FS`)
    }
  }
  out.push(`^PQ${copies},0,1,N`, '^XZ')
  return out
}

// ------------------------------------------------------------------------------------------------ travail complet

/**
 * Commandes d'impression directe d'une série d'étiquettes pour un rouleau thermique. Ne lève que pour un profil qui
 * n'est pas un envoi direct ou un travail démesuré ; un code-barres invalide ou absent donne une étiquette de prix
 * seule + un `issue`, comme pour le rendu HTML.
 */
export function buildLabelCommands(labels: LabelModel[], profile: PrintProfile, contentOptions: Partial<LabelContentOptions> = {}): LabelCommandsJob {
  if (profile.kind !== 'THERMAL_ROLL') {
    throw new LabelCommandsError("L'envoi direct est réservé aux imprimantes à rouleau.", 'NOT_A_ROLL')
  }
  if (profile.language !== 'TSPL' && profile.language !== 'ZPL') {
    throw new LabelCommandsError("Le langage de l'imprimante doit être TSPL ou ZPL.", 'NOT_A_PRINTER_LANGUAGE')
  }
  const options: LabelContentOptions = { ...DEFAULT_CONTENT_OPTIONS, ...contentOptions }
  const issues: LabelIssue[] = findDuplicateBarcodes(labels)
  const ctx: RenderContext = {
    layout: profile.layout,
    spec: TIERS[tierForLayout(profile.layout)],
    options,
    dpi: profile.dpi,
    issues,
    svgCache: new Map(),
    tooSmallReported: new Set(),
  }

  const plans: { plan: LabelPlan; copies: number }[] = []
  let labelCount = 0
  for (const label of labels) {
    const copies = Math.max(0, Math.floor(label.copies))
    if (copies === 0) {
      issues.push({ productId: label.productId, kind: 'NO_COPIES' })
      continue
    }
    labelCount += copies
    plans.push({ plan: planLabel(computeLabelMetrics(label, ctx), profile), copies })
  }
  if (labelCount > MAX_LABELS_PER_JOB) {
    throw new LabelCommandsError(`Trop d'étiquettes (${labelCount}) : maximum ${MAX_LABELS_PER_JOB} par impression`, 'TOO_MANY_LABELS')
  }

  const lines = profile.language === 'TSPL' ? tsplJob(plans, profile) : plans.flatMap(({ plan, copies }) => zplLabel(plan, copies))
  return {
    language: profile.language,
    payload: lines.join('\r\n') + '\r\n',
    encoding: profile.language === 'TSPL' ? 'windows-1252' : 'utf-8',
    labelCount,
    issues,
  }
}

/** Étiquette d'essai en commandes natives : sens d'impression, détection des étiquettes, centrage et lecture du code. */
export function buildTestCommands(profile: PrintProfile, options: { sampleName?: string; locale?: LabelContentOptions['locale'] } = {}): LabelCommandsJob {
  const sample: LabelModel = {
    productId: 'test',
    name: options.sampleName ?? "Étiquette d'essai",
    price: 12500,
    currency: 'GNF',
    barcode: withEan13CheckDigit('200000000000'),
    copies: 1,
  }
  return buildLabelCommands([sample], profile, { showBarcode: true, locale: options.locale ?? 'fr' })
}
