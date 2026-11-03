import { BarcodeFormat, BinaryBitmap, DecodeHintType, HybridBinarizer, MultiFormatReader, RGBLuminanceSource } from '@zxing/library'

/**
 * Vérification INDÉPENDANTE des encodeurs : les modules sont rendus en image (niveaux de gris) puis relus
 * par ZXing — le même moteur que le scanner web de l'app (`@zxing/browser`). Un test qui ne ferait que
 * relire nos propres tables prouverait seulement qu'elles sont cohérentes entre elles, pas qu'elles sont justes.
 */
export function decodeModules(modules: string, { scale = 3, quietModules = 12, height = 48 } = {}): { text: string; format: string } {
  const width = (modules.length + 2 * quietModules) * scale
  const luminance = new Uint8ClampedArray(width * height).fill(255)
  for (let m = 0; m < modules.length; m++) {
    if (modules[m] !== '1') continue
    for (let y = 0; y < height; y++) {
      const start = y * width + (quietModules + m) * scale
      luminance.fill(0, start, start + scale)
    }
  }

  const hints = new Map<DecodeHintType, unknown>()
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.CODE_128])
  hints.set(DecodeHintType.TRY_HARDER, true)

  const reader = new MultiFormatReader()
  reader.setHints(hints)
  const result = reader.decode(new BinaryBitmap(new HybridBinarizer(new RGBLuminanceSource(luminance, width, height))))
  return { text: result.getText(), format: BarcodeFormat[result.getBarcodeFormat()] }
}
