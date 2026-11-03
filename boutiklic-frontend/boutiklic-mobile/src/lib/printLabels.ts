import * as Print from 'expo-print'
import { pageSizePoints, type LabelLayout } from '@boutiklic/shared'
import { isPrintCancelled } from './printCancel'

/**
 * Imprime le document HTML d'étiquettes (`buildLabelsDocument`) via la boîte de dialogue d'impression du
 * système (Android / iOS). Lu dans le code natif d'expo-print installé et dans sa documentation : `width` /
 * `height` sont la taille de la page **en points** (1/72 pouce, entiers) ; sur Android le HTML est rendu par une
 * WebView vers un PDF **vectoriel** (les codes-barres SVG restent nets), sans marges (les marges de page sont
 * de toute façon dans le CSS `@page{margin:0}` du document) ; sans ces valeurs la page serait un US Letter
 * (612 × 792) et une planche A4 serait mal cadrée. iOS applique les mêmes `width`/`height` et ses `margins`.
 *
 * Annuler le dialogue n'est pas une erreur (iOS rejette alors la promesse — cf. `isPrintCancelled`) ; toute
 * autre erreur remonte à l'appelant.
 */
export async function printLabelsDocument(html: string, layout: Pick<LabelLayout, 'pageWidthMm' | 'pageHeightMm'>): Promise<void> {
  const { width, height } = pageSizePoints(layout)
  try {
    await Print.printAsync({ html, width, height, margins: { top: 0, right: 0, bottom: 0, left: 0 } })
  } catch (error) {
    if (!isPrintCancelled(error)) throw error
  }
}
