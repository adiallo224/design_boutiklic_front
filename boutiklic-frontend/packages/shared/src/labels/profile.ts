import { layoutForPreset } from './layouts'
import type { LabelLayout, PrintConnection, PrinterKind, PrintLanguage, PrintProfile } from './types'

export const DEFAULT_A4_PRESET_ID = 'small-24'
export const DEFAULT_ROLL_PRESET_ID = 'roll-50x30'

export const DEFAULT_A4_DPI = 300
export const DEFAULT_THERMAL_DPI = 203
/** Intervalle standard entre étiquettes d'un rouleau (mm). */
export const DEFAULT_GAP_MM = 2

export interface CreateProfileInput {
  id: string
  name: string
  kind: PrinterKind
  presetId?: string
  /** Grille personnalisée ; impose `presetId = 'custom'`. */
  layout?: LabelLayout
  offsetXMm?: number
  offsetYMm?: number
  dpi?: number
  gapMm?: number
  connection?: PrintConnection
  language?: PrintLanguage
  deviceId?: string | null
}

/**
 * Profil d'impression prêt à l'emploi. Sans configuration, un appareil part sur « A4, 24 étiquettes,
 * dialogue système » (cf. étude §3.3) : l'app fonctionne sans réglage préalable.
 */
export function createPrintProfile(input: CreateProfileInput): PrintProfile {
  const defaultPresetId = input.kind === 'SHEET_A4' ? DEFAULT_A4_PRESET_ID : DEFAULT_ROLL_PRESET_ID
  let presetId = input.presetId ?? defaultPresetId
  let layout: LabelLayout | null

  if (input.layout) {
    presetId = 'custom'
    layout = input.layout
  } else {
    layout = layoutForPreset(presetId)
  }
  if (!layout) {
    throw new Error(`Préréglage d'étiquettes inconnu : ${presetId}`)
  }

  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    presetId,
    layout,
    offsetXMm: input.offsetXMm ?? 0,
    offsetYMm: input.offsetYMm ?? 0,
    gapMm: input.gapMm ?? DEFAULT_GAP_MM,
    dpi: input.dpi ?? (input.kind === 'SHEET_A4' ? DEFAULT_A4_DPI : DEFAULT_THERMAL_DPI),
    connection: input.connection ?? 'SYSTEM_DIALOG',
    language: input.language ?? 'HTML',
    deviceId: input.deviceId ?? null,
  }
}
