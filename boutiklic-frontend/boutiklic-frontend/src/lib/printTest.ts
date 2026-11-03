import { buildTestDocument, type LabelContentOptions, type PrintProfile } from '@boutiklic/shared'
import { printHtmlDocument } from './printHtml'
import { printTestDirect, willPrintDirectly } from './rawPrint'

/**
 * Page d'essai d'un profil (Réglages › Impression, éditeur de profil) : envoi direct (une étiquette en commandes
 * natives) si le profil le demande ET que l'app bureau le permet, sinon la planche/étiquette d'essai HTML par le
 * dialogue système. Même règle que l'impression réelle (`useLabelJob`).
 */
export async function printTestPage(
  profile: PrintProfile,
  texts: { sampleName: string; title: string; locale: LabelContentOptions['locale'] },
): Promise<void> {
  if (willPrintDirectly(profile)) {
    await printTestDirect(profile, { sampleName: texts.sampleName, locale: texts.locale })
    return
  }
  await printHtmlDocument(buildTestDocument(profile, { sampleName: texts.sampleName, title: texts.title, locale: texts.locale }).html)
}
