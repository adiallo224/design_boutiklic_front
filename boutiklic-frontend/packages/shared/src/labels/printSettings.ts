import { layoutForPreset, validateLayout } from './layouts'
import { createPrintProfile } from './profile'
import { parseNetworkTarget } from './rawTarget'
import type { LabelContentOptions, LabelLayout, PrintConnection, PrinterKind, PrintLanguage, PrintProfile } from './types'

/**
 * Réglages d'impression d'un appareil (cf. étude §3.3) : profils + profil actif + dernières options de
 * contenu. Stockés localement par appareil (localStorage web/desktop, AsyncStorage mobile), jamais
 * synchronisés — une imprimante est un objet physique lié à un poste. Ce module ne fait AUCUNE E/S : il
 * valide et transforme, pour être partagé tel quel avec le mobile.
 */

export const PRINT_SETTINGS_VERSION = 1

/** Options de contenu mémorisées d'une impression à l'autre (le reste — case de départ, titre — est propre à un travail). */
export interface PersistedContentOptions
  extends Pick<LabelContentOptions, 'showBarcode' | 'showShopName' | 'showCategory' | 'showCutMarks'> {
  /** Afficher l'ancien prix barré + le prix promo quand une promotion s'applique (cf. `resolvePrice`). */
  showPromoPrice: boolean
}

export const DEFAULT_PERSISTED_CONTENT: PersistedContentOptions = {
  showBarcode: true,
  showShopName: false,
  showCategory: false,
  showCutMarks: false,
  showPromoPrice: true,
}

export interface PrintSettings {
  version: typeof PRINT_SETTINGS_VERSION
  profiles: PrintProfile[]
  activeProfileId: string
  content: PersistedContentOptions
}

export const MIN_DPI = 72
export const MAX_DPI = 1200
export const MAX_OFFSET_MM = 20
export const MAX_GAP_MM = 10
export const MAX_PROFILE_NAME_LENGTH = 40

const KINDS: readonly PrinterKind[] = ['SHEET_A4', 'THERMAL_ROLL']
const CONNECTIONS: readonly PrintConnection[] = ['SYSTEM_DIALOG', 'USB_RAW', 'NETWORK', 'BLUETOOTH']
const LANGUAGES: readonly PrintLanguage[] = ['HTML', 'TSPL', 'ZPL']

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function sanitizeLayout(value: unknown): LabelLayout | null {
  if (!isRecord(value)) return null
  const keys = [
    'pageWidthMm', 'pageHeightMm', 'columns', 'rows', 'marginLeftMm', 'marginTopMm',
    'gutterXMm', 'gutterYMm', 'cellWidthMm', 'cellHeightMm', 'paddingMm',
  ] as const
  const layout = {} as Record<(typeof keys)[number], number>
  for (const key of keys) {
    const v = value[key]
    if (!isFiniteNumber(v)) return null
    layout[key] = v
  }
  return validateLayout(layout).length === 0 ? layout : null
}

/**
 * Reconstruit un profil depuis une donnée quelconque (JSON stocké, potentiellement ancien ou altéré) ;
 * `null` si irrécupérable. Un préréglage connu est ré-résolu depuis son id : une amélioration des
 * préréglages profite ainsi aux profils déjà enregistrés. Seul `custom` conserve la grille stockée.
 */
export function sanitizeProfile(input: unknown): PrintProfile | null {
  if (!isRecord(input)) return null
  const { id, name, kind, presetId } = input
  if (typeof id !== 'string' || id === '') return null
  if (typeof name !== 'string' || name.trim() === '') return null
  if (typeof kind !== 'string' || !KINDS.includes(kind as PrinterKind)) return null
  if (typeof presetId !== 'string') return null

  let layout: LabelLayout | null
  if (presetId === 'custom') {
    layout = sanitizeLayout(input.layout)
  } else {
    layout = layoutForPreset(presetId)
    // Un préréglage doit correspondre au type de l'imprimante (pas de « A5 » sur un rouleau).
    if (layout && (kind === 'THERMAL_ROLL') !== presetId.startsWith('roll-')) layout = null
  }
  if (!layout) return null

  const dpi = isFiniteNumber(input.dpi) ? clamp(Math.round(input.dpi), MIN_DPI, MAX_DPI) : undefined
  const requestedConnection = CONNECTIONS.includes(input.connection as PrintConnection) ? (input.connection as PrintConnection) : 'SYSTEM_DIALOG'
  const requestedLanguage = LANGUAGES.includes(input.language as PrintLanguage) ? (input.language as PrintLanguage) : 'HTML'
  const target = typeof input.deviceId === 'string' ? input.deviceId.trim() : ''

  // Cohérence : un envoi DIRECT exige un rouleau thermique, un langage d'imprimante (TSPL/ZPL) et une cible valide
  // (nom d'imprimante Windows, adresse hôte[:port], identifiant Bluetooth). Sinon on retombe sur le dialogue système,
  // le seul mode qui marche toujours — jamais un profil qui échouerait à l'impression.
  const targetValid = requestedConnection === 'NETWORK' ? parseNetworkTarget(target) !== null : target !== ''
  const direct =
    requestedConnection !== 'SYSTEM_DIALOG' && kind === 'THERMAL_ROLL' && (requestedLanguage === 'TSPL' || requestedLanguage === 'ZPL') && targetValid

  return createPrintProfile({
    id,
    name: name.trim().slice(0, MAX_PROFILE_NAME_LENGTH),
    kind: kind as PrinterKind,
    ...(presetId === 'custom' ? { layout } : { presetId }),
    offsetXMm: isFiniteNumber(input.offsetXMm) ? clamp(input.offsetXMm, -MAX_OFFSET_MM, MAX_OFFSET_MM) : 0,
    offsetYMm: isFiniteNumber(input.offsetYMm) ? clamp(input.offsetYMm, -MAX_OFFSET_MM, MAX_OFFSET_MM) : 0,
    gapMm: isFiniteNumber(input.gapMm) ? clamp(input.gapMm, 0, MAX_GAP_MM) : undefined,
    dpi,
    connection: direct ? requestedConnection : 'SYSTEM_DIALOG',
    language: direct ? requestedLanguage : 'HTML',
    deviceId: direct ? target : null,
  })
}

function sanitizeContent(input: unknown): PersistedContentOptions {
  const content = { ...DEFAULT_PERSISTED_CONTENT }
  if (!isRecord(input)) return content
  for (const key of Object.keys(content) as (keyof PersistedContentOptions)[]) {
    if (typeof input[key] === 'boolean') content[key] = input[key] as boolean
  }
  return content
}

/** Réglages d'un appareil neuf : un profil « A4, 24 étiquettes, dialogue système » — l'app marche sans configuration. */
export function defaultPrintSettings(newId: () => string, defaultProfileName = 'A4'): PrintSettings {
  const profile = createPrintProfile({ id: newId(), name: defaultProfileName, kind: 'SHEET_A4' })
  return { version: PRINT_SETTINGS_VERSION, profiles: [profile], activeProfileId: profile.id, content: { ...DEFAULT_PERSISTED_CONTENT } }
}

/**
 * Lit les réglages stockés. Ne lève jamais : absent, JSON cassé, version inconnue ou profils invalides
 * se traduisent par des réglages par défaut (ou par les seuls profils encore valides).
 */
export function parsePrintSettings(raw: string | null | undefined, newId: () => string, defaultProfileName?: string): PrintSettings {
  if (!raw) return defaultPrintSettings(newId, defaultProfileName)
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return defaultPrintSettings(newId, defaultProfileName)
  }
  if (!isRecord(data) || data.version !== PRINT_SETTINGS_VERSION || !Array.isArray(data.profiles)) {
    return defaultPrintSettings(newId, defaultProfileName)
  }

  const seen = new Set<string>()
  const profiles: PrintProfile[] = []
  for (const candidate of data.profiles) {
    const profile = sanitizeProfile(candidate)
    if (!profile || seen.has(profile.id)) continue
    seen.add(profile.id)
    profiles.push(profile)
  }
  if (profiles.length === 0) return defaultPrintSettings(newId, defaultProfileName)

  const activeProfileId =
    typeof data.activeProfileId === 'string' && seen.has(data.activeProfileId) ? data.activeProfileId : profiles[0].id
  return { version: PRINT_SETTINGS_VERSION, profiles, activeProfileId, content: sanitizeContent(data.content) }
}

export function serializePrintSettings(settings: PrintSettings): string {
  return JSON.stringify(settings)
}

export function getActiveProfile(settings: PrintSettings): PrintProfile {
  return settings.profiles.find((p) => p.id === settings.activeProfileId) ?? settings.profiles[0]
}

/** Ajoute ou remplace (même id) un profil. Le profil est re-validé : une saisie invalide est refusée (`null`). */
export function upsertProfile(settings: PrintSettings, profile: PrintProfile): PrintSettings | null {
  const clean = sanitizeProfile(profile)
  if (!clean) return null
  const exists = settings.profiles.some((p) => p.id === clean.id)
  const profiles = exists ? settings.profiles.map((p) => (p.id === clean.id ? clean : p)) : [...settings.profiles, clean]
  return { ...settings, profiles }
}

/** Supprime un profil ; on ne supprime jamais le dernier (l'app doit toujours avoir de quoi imprimer). */
export function removeProfile(settings: PrintSettings, profileId: string): PrintSettings {
  if (settings.profiles.length <= 1 || !settings.profiles.some((p) => p.id === profileId)) return settings
  const profiles = settings.profiles.filter((p) => p.id !== profileId)
  const activeProfileId = settings.activeProfileId === profileId ? profiles[0].id : settings.activeProfileId
  return { ...settings, profiles, activeProfileId }
}

export function setActiveProfile(settings: PrintSettings, profileId: string): PrintSettings {
  return settings.profiles.some((p) => p.id === profileId) ? { ...settings, activeProfileId: profileId } : settings
}

export function updateContent(settings: PrintSettings, patch: Partial<PersistedContentOptions>): PrintSettings {
  return { ...settings, content: sanitizeContent({ ...settings.content, ...patch }) }
}
