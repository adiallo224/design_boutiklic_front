import { invoke, isTauri } from '@tauri-apps/api/core'
import {
  buildLabelCommands,
  buildTestCommands,
  encodePayload,
  parseNetworkTarget,
  type LabelCommandsJob,
  type LabelContentOptions,
  type LabelModel,
  type PrintProfile,
} from '@boutiklic/shared'

/**
 * Impression DIRECTE d'étiquettes (phase 6) : les commandes natives de l'imprimante (TSPL/ZPL, fabriquées par
 * @boutiklic/shared) sont confiées aux commandes Rust de l'app bureau (`boutiklic-desktop/src-tauri/src/raw_print.rs`) :
 * spouleur Windows en mode RAW (USB / imprimante installée) ou TCP 9100 (réseau). Uniquement dans l'app bureau Tauri —
 * un navigateur ne peut ni parler au spouleur ni ouvrir de socket TCP.
 */

/** Vrai dans l'app bureau (Tauri) seulement. */
export const isRawPrintAvailable = (): boolean => isTauri()

/** Ce profil demande-t-il un envoi direct (et non le dialogue système) ? */
export const isDirectProfile = (profile: PrintProfile): boolean => profile.kind === 'THERMAL_ROLL' && profile.connection !== 'SYSTEM_DIALOG'

/** Le profil sera-t-il réellement envoyé en direct SUR CET APPAREIL ? (sinon : dialogue système) */
export const willPrintDirectly = (profile: PrintProfile): boolean => isDirectProfile(profile) && isRawPrintAvailable()

/** Message lisible d'une erreur de commande Tauri (`Err(String)` côté Rust arrive telle quelle, en chaîne). */
export function rawPrintErrorMessage(error: unknown): string {
  if (typeof error === 'string') return error
  if (error instanceof Error) return error.message
  return 'Erreur inconnue'
}

/** Imprimantes installées sur ce poste (Windows) ; liste vide hors app bureau ou hors Windows. */
export async function listSystemPrinters(): Promise<string[]> {
  if (!isRawPrintAvailable()) return []
  return invoke<string[]>('list_printers')
}

/** Envoie un travail de commandes à l'imprimante du profil. Lève (message lisible) si l'envoi échoue. */
export async function sendLabelCommands(profile: PrintProfile, job: LabelCommandsJob): Promise<void> {
  if (!isRawPrintAvailable()) throw new Error("L'envoi direct nécessite l'application bureau.")
  // Tauri sérialise un Vec<u8> attendu depuis un tableau de nombres.
  const data = Array.from(encodePayload(job.payload, job.encoding))

  if (profile.connection === 'USB_RAW') {
    if (!profile.deviceId) throw new Error("Aucune imprimante choisie pour ce profil.")
    await invoke('print_raw', { printer: profile.deviceId, data })
    return
  }
  if (profile.connection === 'NETWORK') {
    const target = parseNetworkTarget(profile.deviceId)
    if (!target) throw new Error("Adresse d'imprimante invalide pour ce profil.")
    await invoke('send_tcp', { host: target.host, port: target.port, data })
    return
  }
  throw new Error("Ce mode de connexion n'est pas disponible sur ordinateur.")
}

/** Imprime des étiquettes en direct : fabrique les commandes du profil puis les envoie. */
export async function printLabelsDirect(labels: LabelModel[], profile: PrintProfile, options: Partial<LabelContentOptions>): Promise<LabelCommandsJob> {
  const job = buildLabelCommands(labels, profile, options)
  await sendLabelCommands(profile, job)
  return job
}

/** Étiquette d'essai en direct (une seule étiquette, code interne d'essai). */
export async function printTestDirect(profile: PrintProfile, options: { sampleName?: string; locale?: LabelContentOptions['locale'] } = {}): Promise<void> {
  await sendLabelCommands(profile, buildTestCommands(profile, options))
}
