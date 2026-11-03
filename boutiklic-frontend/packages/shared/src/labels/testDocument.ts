import { buildLabelsDocument } from './buildLabelsDocument'
import { withEan13CheckDigit } from './ean13'
import { labelsPerPage } from './layouts'
import type { LabelContentOptions, LabelModel, LabelsDocument, PrintProfile } from './types'

/**
 * Page d'essai (cf. étude §3.3) : une page pleine d'étiquettes factices, avec traits de coupe, à imprimer
 * avant de gâcher une vraie planche — permet de vérifier le calage (décalage X/Y), la taille de page réelle
 * et que le code-barres est bien lu au scan. Le code d'essai est un EAN-13 « usage interne » (préfixe 20),
 * sans risque de collision avec un vrai article.
 */
export const TEST_BARCODE = withEan13CheckDigit('200000000000')

export function buildTestDocument(
  profile: PrintProfile,
  options: { sampleName?: string; title?: string; locale?: LabelContentOptions['locale'] } = {},
): LabelsDocument {
  const sample: LabelModel = {
    productId: 'test',
    name: options.sampleName ?? "Étiquette d'essai",
    price: 12500,
    currency: 'GNF',
    barcode: TEST_BARCODE,
    copies: labelsPerPage(profile.layout),
  }
  return buildLabelsDocument([sample], profile, {
    showCutMarks: true,
    showBarcode: true,
    locale: options.locale ?? 'fr',
    title: options.title ?? 'Page d’essai',
  })
}
