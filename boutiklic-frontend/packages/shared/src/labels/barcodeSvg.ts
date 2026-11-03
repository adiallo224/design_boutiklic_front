import { totalModules } from './barcode'
import type { BarcodeEncoding } from './types'

export interface BarcodeSvgOptions {
  moduleWidthMm: number
  heightMm: number
}

const round = (n: number) => Number(n.toFixed(4))

/** Chemin SVG (unités = modules) : une entrée `M x 0 h w v 1 h -w z` par barre, barres contiguës fusionnées. */
export function barcodePath(encoding: BarcodeEncoding): string {
  const offset = encoding.quietZoneModules
  const { modules } = encoding
  let path = ''
  let i = 0
  while (i < modules.length) {
    if (modules[i] !== '1') {
      i++
      continue
    }
    let j = i
    while (j < modules.length && modules[j] === '1') j++
    path += `M${offset + i} 0h${j - i}v1h-${j - i}z`
    i = j
  }
  return path
}

/**
 * SVG vectoriel, en mm, zones de silence comprises. Le viewBox est en modules (largeur) × 1 (hauteur) avec
 * `preserveAspectRatio="none"` : la hauteur des barres est libre, la largeur d'un module est exactement
 * `moduleWidthMm`. Pas d'image : net à toute résolution, et sans DOM donc utilisable dans `expo-print`.
 */
export function barcodeSvg(encoding: BarcodeEncoding, { moduleWidthMm, heightMm }: BarcodeSvgOptions): string {
  const modules = totalModules(encoding)
  const width = round(modules * moduleWidthMm)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${round(heightMm)}mm" ` +
    `viewBox="0 0 ${modules} 1" preserveAspectRatio="none" shape-rendering="crispEdges">` +
    `<path fill="#000" d="${barcodePath(encoding)}"/></svg>`
  )
}
