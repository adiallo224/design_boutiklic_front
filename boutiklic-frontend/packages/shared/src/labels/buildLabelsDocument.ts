import { formatNumber } from '../formatting'
import { BarcodeEncodingError, encodeBarcode, snapModuleWidthMm, totalModules } from './barcode'
import { barcodeSvg } from './barcodeSvg'
import { labelsPerPage, tierForLayout, type LabelSizeTier } from './layouts'
import {
  DEFAULT_CONTENT_OPTIONS,
  type BarcodeEncoding,
  type LabelContentOptions,
  type LabelIssue,
  type LabelLayout,
  type LabelModel,
  type LabelsDocument,
  type PrintProfile,
} from './types'

/** Garde-fou : un travail d'impression au-delà est presque sûrement une erreur de saisie (quantité). */
export const MAX_LABELS_PER_JOB = 2000

/** Sous cette largeur de module, un code-barres n'est plus fiable au scan (≈ 0,19 mm). */
export const MIN_MODULE_MM = 0.19
const MIN_BAR_HEIGHT_MM = 6
export const LINE = 1.15
const NAME_CHAR_RATIO = 0.6
const PRICE_CHAR_RATIO = 0.62
/** Marge retirée à la hauteur d'une page pour éviter une page blanche finale (arrondis du moteur d'impression). */
const PAGE_HEIGHT_SLACK_MM = 0.2

export interface TierSpec {
  nameMaxMm: number
  nameLines: number
  priceMaxMm: number
  smallMm: number
  barHeightFrac: number
  barWidthFrac: number
  maxModuleMm: number
  gapMm: number
}

export const TIERS: Record<LabelSizeTier, TierSpec> = {
  XL: { nameMaxMm: 16, nameLines: 3, priceMaxMm: 60, smallMm: 8, barHeightFrac: 0.2, barWidthFrac: 0.7, maxModuleMm: 1.1, gapMm: 6 },
  L: { nameMaxMm: 9, nameLines: 3, priceMaxMm: 26, smallMm: 5, barHeightFrac: 0.2, barWidthFrac: 0.8, maxModuleMm: 0.8, gapMm: 4 },
  M: { nameMaxMm: 5.2, nameLines: 2, priceMaxMm: 13, smallMm: 3, barHeightFrac: 0.26, barWidthFrac: 0.8, maxModuleMm: 0.5, gapMm: 2 },
  S: { nameMaxMm: 3.6, nameLines: 2, priceMaxMm: 8.5, smallMm: 2.4, barHeightFrac: 0.3, barWidthFrac: 0.85, maxModuleMm: 0.4, gapMm: 1 },
}

const mm = (n: number) => `${Number(n.toFixed(3))}mm`

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export function formatPrice(amount: number, currency: string, locale: LabelContentOptions['locale']): string {
  if (!Number.isFinite(amount) || amount < 0) return '—'
  const digits = Number.isInteger(amount) ? 0 : 2
  // Espace fine insécable (U+202F) → espace insécable classique : glyphe présent dans toutes les polices d'imprimante.
  const number = formatNumber(amount, locale, { minimumFractionDigits: digits, maximumFractionDigits: 2 }).replace(/ /g, ' ')
  return `${number} ${currency}`
}

export interface RenderContext {
  layout: LabelLayout
  spec: TierSpec
  options: LabelContentOptions
  dpi: number
  issues: LabelIssue[]
  svgCache: Map<string, string>
  tooSmallReported: Set<string>
}

/** Tailles et contenus calculés d'UNE étiquette (mm) — partagés par le rendu HTML et le moteur de commandes
 *  d'imprimante (TSPL/ZPL) : mêmes textes, mêmes tailles, même largeur de barres calée sur les points de l'imprimante. */
export interface LabelMetrics {
  usableW: number
  usableH: number
  encoding: BarcodeEncoding | null
  name: string
  priceText: string
  hasPrevious: boolean
  previousText: string
  shopName: string
  category: string
  nameFont: number
  nameLines: number
  small: number
  priceFont: number
  previousFont: number
  gap: number
  barHeight: number
  digitsFont: number
  /** Largeur d'un module (mm), déjà calée sur un nombre entier de points ; 0 sans code-barres. */
  moduleWidth: number
}

export function computeLabelMetrics(label: LabelModel, ctx: RenderContext): LabelMetrics {
  const { layout, spec, options } = ctx
  const usableW = layout.cellWidthMm - 2 * layout.paddingMm
  const usableH = layout.cellHeightMm - 2 * layout.paddingMm

  if (!Number.isFinite(label.price) || label.price < 0) ctx.issues.push({ productId: label.productId, kind: 'INVALID_PRICE' })

  // --- code-barres ---
  let encoding: BarcodeEncoding | null = null
  const rawBarcode = label.barcode?.trim() ?? ''
  if (options.showBarcode) {
    if (rawBarcode === '') {
      ctx.issues.push({ productId: label.productId, kind: 'NO_BARCODE' })
    } else {
      try {
        encoding = encodeBarcode(rawBarcode)
      } catch (error) {
        if (!(error instanceof BarcodeEncodingError)) throw error
        ctx.issues.push({ productId: label.productId, kind: 'UNENCODABLE_BARCODE', barcode: rawBarcode })
      }
    }
  }

  // --- textes ---
  const name = label.name.trim()
  const priceText = formatPrice(label.price, label.currency, options.locale)
  const hasPrevious = label.previousPrice != null && label.previousPrice > label.price
  const previousText = hasPrevious ? formatPrice(label.previousPrice as number, label.currency, options.locale) : ''
  const shopName = options.showShopName ? options.shopName?.trim() ?? '' : ''
  const category = options.showCategory ? label.categoryName?.trim() ?? '' : ''

  let nameFont = spec.nameMaxMm
  let small = spec.smallMm
  let priceFont = Math.min(spec.priceMaxMm, usableW / (Math.max(priceText.length, 1) * PRICE_CHAR_RATIO))
  const estimatedLines = Math.ceil((name.length * NAME_CHAR_RATIO * nameFont) / usableW)
  const nameLines = Math.min(spec.nameLines, Math.max(1, estimatedLines))
  let previousFont = hasPrevious ? Math.max(small, priceFont * 0.4) : 0
  let gap = spec.gapMm
  let barHeight = encoding ? spec.barHeightFrac * usableH : 0
  let digitsFont = small

  // --- budget vertical : on rétrécit d'abord la hauteur des barres (jusqu'à un minimum), puis le texte ---
  const textHeight = () =>
    (shopName ? small * LINE : 0) +
    (category ? small * LINE : 0) +
    (name ? nameLines * nameFont * LINE : 0) +
    previousFont * LINE +
    priceFont * LINE
  const barcodeBlock = () => (encoding ? barHeight + digitsFont * LINE + gap : 0)

  let excess = textHeight() + barcodeBlock() - usableH
  if (excess > 0 && encoding) {
    const cut = Math.min(excess, Math.max(0, barHeight - MIN_BAR_HEIGHT_MM))
    barHeight -= cut
    excess -= cut
  }
  if (excess > 0) {
    const available = usableH - (encoding ? barHeight : 0)
    const k = Math.max(0.3, available / (textHeight() + (encoding ? digitsFont * LINE + gap : 0)))
    nameFont *= k
    small *= k
    priceFont *= k
    previousFont *= k
    digitsFont *= k
    gap *= k
  }

  let moduleWidth = 0
  if (encoding) {
    const modules = totalModules(encoding)
    moduleWidth = snapModuleWidthMm(Math.min((usableW * spec.barWidthFrac) / modules, spec.maxModuleMm), ctx.dpi)
    if (moduleWidth < MIN_MODULE_MM) {
      // Le calage sur un nombre entier de points est tombé sous le minimum de lecture : on retente avec toute
      // la largeur utile (ex. 2 points à 203 dpi = 0,25 mm) avant de signaler un code trop dense.
      moduleWidth = Math.max(moduleWidth, snapModuleWidthMm(Math.min(usableW / modules, spec.maxModuleMm), ctx.dpi))
    }
    if (moduleWidth < MIN_MODULE_MM && !ctx.tooSmallReported.has(encoding.value)) {
      ctx.tooSmallReported.add(encoding.value)
      ctx.issues.push({ productId: label.productId, kind: 'BARCODE_TOO_SMALL', barcode: encoding.value })
    }
  }

  return { usableW, usableH, encoding, name, priceText, hasPrevious, previousText, shopName, category, nameFont, nameLines, small, priceFont, previousFont, gap, barHeight, digitsFont, moduleWidth }
}

function renderLabel(label: LabelModel, ctx: RenderContext): string {
  const m = computeLabelMetrics(label, ctx)
  const { encoding, name, priceText, hasPrevious, previousText, shopName, category, nameFont, nameLines, small, priceFont, previousFont, gap, barHeight, digitsFont, moduleWidth } = m

  // --- rendu ---
  const top: string[] = []
  if (shopName) top.push(`<div class="s" style="font-size:${mm(small)}">${escapeHtml(shopName)}</div>`)
  if (name) {
    top.push(
      `<div class="n" style="font-size:${mm(nameFont)};-webkit-line-clamp:${nameLines};line-clamp:${nameLines};max-height:${mm(nameLines * nameFont * LINE)}">${escapeHtml(name)}</div>`,
    )
  }
  if (category) top.push(`<div class="s" style="font-size:${mm(small)}">${escapeHtml(category)}</div>`)

  const middle: string[] = []
  if (hasPrevious) middle.push(`<div class="o" style="font-size:${mm(previousFont)}">${escapeHtml(previousText)}</div>`)
  middle.push(`<div class="p" style="font-size:${mm(priceFont)}">${escapeHtml(priceText)}</div>`)

  let bottom = ''
  if (encoding) {
    const key = `${encoding.value}|${moduleWidth}|${barHeight}`
    let svg = ctx.svgCache.get(key)
    if (!svg) {
      svg = barcodeSvg(encoding, { moduleWidthMm: moduleWidth, heightMm: barHeight })
      ctx.svgCache.set(key, svg)
    }
    bottom = `<div class="b" style="margin-top:${mm(gap)}">${svg}<div class="d" style="font-size:${mm(digitsFont)}">${escapeHtml(encoding.humanReadable)}</div></div>`
  }

  return `<div class="t">${top.join('')}</div><div class="m">${middle.join('')}</div>${bottom}`
}

function buildCss(layout: LabelLayout): string {
  const pageW = mm(layout.pageWidthMm)
  const pageH = mm(layout.pageHeightMm)
  return [
    '*{box-sizing:border-box}',
    `@page{size:${pageW} ${pageH};margin:0}`,
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}',
    'body{font-family:Arial,Helvetica,sans-serif;color:#000}',
    `.page{position:relative;width:${pageW};height:${mm(layout.pageHeightMm - PAGE_HEIGHT_SLACK_MM)};overflow:hidden;background:#fff;break-after:page;page-break-after:always}`,
    '.page:last-child{break-after:auto;page-break-after:auto}',
    '.cell{position:absolute;display:flex;flex-direction:column;align-items:center;justify-content:space-between;text-align:center;overflow:hidden}',
    '.cut{border:0.2mm dashed #888}',
    '.t{width:100%}',
    '.m{flex:1;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}',
    '.n{font-weight:700;line-height:1.15;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}',
    '.s{line-height:1.15}',
    '.o{text-decoration:line-through;line-height:1.15;white-space:nowrap}',
    '.p{font-weight:800;line-height:1.15;white-space:nowrap}',
    '.b{display:flex;flex-direction:column;align-items:center}',
    '.b svg{display:block}',
    '.d{line-height:1.15;letter-spacing:.05em;white-space:nowrap;padding-top:.4mm}',
    '@media screen{body{background:#e6e6e6}.page{margin:0 auto 6mm;box-shadow:0 0 3mm rgba(0,0,0,.25)}}',
  ].join('')
}

/** Signale les codes partagés par plusieurs articles distincts (la caisse n'en retrouvera qu'un). */
export function findDuplicateBarcodes(labels: LabelModel[]): LabelIssue[] {
  const owners = new Map<string, Set<string>>()
  for (const label of labels) {
    const code = label.barcode?.trim()
    if (!code) continue
    const set = owners.get(code) ?? new Set<string>()
    set.add(label.productId)
    owners.set(code, set)
  }
  const issues: LabelIssue[] = []
  for (const [barcode, productIds] of owners) {
    if (productIds.size < 2) continue
    for (const productId of productIds) issues.push({ productId, kind: 'DUPLICATE_BARCODE', barcode })
  }
  return issues
}

/**
 * Document HTML complet d'une impression d'étiquettes (moteur « dialogue système », cf. étude §3.4).
 * Fonction pure string → objet, sans JSX ni DOM : même sortie sur web, desktop et mobile (`expo-print`).
 * Ne lève pas pour un code-barres invalide ou absent : l'étiquette est imprimée sans code et le problème
 * est renvoyé dans `issues` pour que l'écran d'impression le signale.
 */
export function buildLabelsDocument(
  labels: LabelModel[],
  profile: PrintProfile,
  contentOptions: Partial<LabelContentOptions> = {},
): LabelsDocument {
  const options: LabelContentOptions = { ...DEFAULT_CONTENT_OPTIONS, ...contentOptions }
  const { layout } = profile
  const issues: LabelIssue[] = findDuplicateBarcodes(labels)

  const slots: (LabelModel | null)[] = Array.from({ length: Math.max(0, Math.floor(options.startIndex)) }, () => null)
  let labelCount = 0
  for (const label of labels) {
    const copies = Math.max(0, Math.floor(label.copies))
    if (copies === 0) {
      issues.push({ productId: label.productId, kind: 'NO_COPIES' })
      continue
    }
    for (let i = 0; i < copies; i++) slots.push(label)
    labelCount += copies
  }
  if (labelCount > MAX_LABELS_PER_JOB) {
    throw new RangeError(`Trop d'étiquettes (${labelCount}) : maximum ${MAX_LABELS_PER_JOB} par impression`)
  }

  const perPage = labelsPerPage(layout)
  const pageCount = Math.ceil(slots.length / perPage)
  const ctx: RenderContext = {
    layout,
    spec: TIERS[tierForLayout(layout)],
    options,
    dpi: profile.dpi,
    issues,
    svgCache: new Map(),
    tooSmallReported: new Set(),
  }

  const pages: string[] = []
  for (let page = 0; page < pageCount; page++) {
    const cells: string[] = []
    for (let slot = 0; slot < perPage; slot++) {
      const label = slots[page * perPage + slot]
      if (!label) continue
      const column = slot % layout.columns
      const row = Math.floor(slot / layout.columns)
      const left = profile.offsetXMm + layout.marginLeftMm + column * (layout.cellWidthMm + layout.gutterXMm)
      const top = profile.offsetYMm + layout.marginTopMm + row * (layout.cellHeightMm + layout.gutterYMm)
      const style = `left:${mm(left)};top:${mm(top)};width:${mm(layout.cellWidthMm)};height:${mm(layout.cellHeightMm)};padding:${mm(layout.paddingMm)}`
      cells.push(`<div class="cell${options.showCutMarks ? ' cut' : ''}" style="${style}">${renderLabel(label, ctx)}</div>`)
    }
    pages.push(`<section class="page">${cells.join('')}</section>`)
  }

  const title = escapeHtml(options.title ?? 'Étiquettes')
  const html =
    `<!doctype html><html lang="${options.locale}"><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>` +
    `<style>${buildCss(layout)}</style></head><body>${pages.join('')}</body></html>`

  return { html, pageCount, labelCount, issues }
}
