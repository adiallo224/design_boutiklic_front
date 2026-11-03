import { A4_HEIGHT_MM, A4_WIDTH_MM, gridLayout, layoutForPreset, rollLayout } from './layouts'
import { DEFAULT_A4_DPI, DEFAULT_A4_PRESET_ID, DEFAULT_GAP_MM, DEFAULT_ROLL_PRESET_ID, DEFAULT_THERMAL_DPI, createPrintProfile } from './profile'
import { MAX_PROFILE_NAME_LENGTH, sanitizeProfile } from './printSettings'
import type { LabelLayout, PrintConnection, PrinterKind, PrintLanguage, PrintProfile } from './types'

/**
 * Logique du formulaire « imprimante » (création / édition d'un profil), partagée par l'éditeur web et mobile :
 * champs saisis en TEXTE (un `TextInput` ne rend que des chaînes), conversion vers un profil VALIDE, ou `null`.
 * Le profil final passe par `sanitizeProfile` — le même code que le rechargement depuis le stockage — donc ce
 * qu'on enregistre est toujours relisible.
 */

export interface CustomLayoutFields {
  columns: string
  rows: string
  cellWidth: string
  cellHeight: string
  marginLeft: string
  marginTop: string
  gutterX: string
  gutterY: string
  padding: string
}

export interface ProfileFormValues {
  name: string
  kind: PrinterKind
  presetId: string
  custom: CustomLayoutFields
  offsetX: string
  offsetY: string
  dpi: number
  /** Intervalle entre étiquettes (mm), saisi en texte. */
  gap: string
  connection: PrintConnection
  /** Langage envoyé à l'imprimante (HTML = dialogue système). */
  language: PrintLanguage
  /** Cible d'un envoi direct : nom de l'imprimante Windows (USB), « hôte[:port] » (réseau) ou identifiant Bluetooth. */
  device: string
}

const toField = (n: number) => String(Number(n.toFixed(3)))

/** « 12,5 » et « 12.5 » sont acceptés (clavier français). `NaN` si non numérique. */
export function parseDecimal(value: string): number {
  return Number.parseFloat(value.replace(',', '.'))
}

export function fieldsFromLayout(layout: LabelLayout): CustomLayoutFields {
  return {
    columns: String(layout.columns),
    rows: String(layout.rows),
    cellWidth: toField(layout.cellWidthMm),
    cellHeight: toField(layout.cellHeightMm),
    marginLeft: toField(layout.marginLeftMm),
    marginTop: toField(layout.marginTopMm),
    gutterX: toField(layout.gutterXMm),
    gutterY: toField(layout.gutterYMm),
    padding: toField(layout.paddingMm),
  }
}

export function layoutFromFields(kind: PrinterKind, fields: CustomLayoutFields): LabelLayout {
  if (kind === 'THERMAL_ROLL') {
    return rollLayout(parseDecimal(fields.cellWidth), parseDecimal(fields.cellHeight), parseDecimal(fields.padding))
  }
  return {
    ...gridLayout(1, 1, { pageWidthMm: A4_WIDTH_MM, pageHeightMm: A4_HEIGHT_MM }),
    columns: parseDecimal(fields.columns),
    rows: parseDecimal(fields.rows),
    cellWidthMm: parseDecimal(fields.cellWidth),
    cellHeightMm: parseDecimal(fields.cellHeight),
    marginLeftMm: parseDecimal(fields.marginLeft),
    marginTopMm: parseDecimal(fields.marginTop),
    gutterXMm: parseDecimal(fields.gutterX),
    gutterYMm: parseDecimal(fields.gutterY),
    paddingMm: parseDecimal(fields.padding),
  }
}

const defaultPreset = (kind: PrinterKind) => (kind === 'SHEET_A4' ? DEFAULT_A4_PRESET_ID : DEFAULT_ROLL_PRESET_ID)
const defaultDpi = (kind: PrinterKind) => (kind === 'SHEET_A4' ? DEFAULT_A4_DPI : DEFAULT_THERMAL_DPI)

/** Formulaire d'une nouvelle imprimante : A4, 24 étiquettes par page. */
export function emptyFormValues(): ProfileFormValues {
  return formValuesForKind({ name: '', kind: 'SHEET_A4', presetId: '', custom: fieldsFromLayout(gridLayout(3, 8)), offsetX: '0', offsetY: '0', dpi: DEFAULT_A4_DPI, gap: String(DEFAULT_GAP_MM), connection: 'SYSTEM_DIALOG', language: 'HTML', device: '' }, 'SHEET_A4', true)
}

export function formValuesFromProfile(profile: PrintProfile): ProfileFormValues {
  return {
    name: profile.name,
    kind: profile.kind,
    presetId: profile.presetId,
    custom: fieldsFromLayout(profile.layout),
    offsetX: toField(profile.offsetXMm),
    offsetY: toField(profile.offsetYMm),
    dpi: profile.dpi,
    gap: toField(profile.gapMm),
    connection: profile.connection,
    language: profile.language,
    device: profile.deviceId ?? '',
  }
}

/** Changer de type d'imprimante repart du préréglage, de la résolution et de la grille par défaut de ce type. */
export function formValuesForKind(values: ProfileFormValues, kind: PrinterKind, force = false): ProfileFormValues {
  if (kind === values.kind && !force) return values
  const presetId = defaultPreset(kind)
  // L'envoi direct n'existe que pour un rouleau : on repart sur le dialogue système.
  return {
    ...values,
    kind,
    presetId,
    dpi: defaultDpi(kind),
    custom: fieldsFromLayout(layoutForPreset(presetId) as LabelLayout),
    connection: 'SYSTEM_DIALOG',
    language: 'HTML',
    device: '',
  }
}

/** Changer de mode d'envoi (rouleau seulement) : repart d'une cible vide, et du langage TSPL dès qu'il s'agit d'un envoi direct. */
export function formValuesForConnection(values: ProfileFormValues, connection: PrintConnection): ProfileFormValues {
  if (connection === values.connection) return values
  if (connection === 'SYSTEM_DIALOG' || values.kind !== 'THERMAL_ROLL') return { ...values, connection: 'SYSTEM_DIALOG', language: 'HTML', device: '' }
  return { ...values, connection, language: values.language === 'HTML' ? 'TSPL' : values.language, device: '' }
}

/** Passer en « personnalisé » repart des dimensions du format courant, à ajuster. */
export function formValuesForPreset(values: ProfileFormValues, presetId: string): ProfileFormValues {
  if (presetId === 'custom' && values.presetId !== 'custom') {
    const current = layoutForPreset(values.presetId)
    return { ...values, presetId, custom: current ? fieldsFromLayout(current) : values.custom }
  }
  return { ...values, presetId }
}

export interface BuildProfileOptions {
  id: string
  /** Nom utilisé quand le champ est vide : la page d'essai n'a pas besoin d'un vrai nom (seul « Enregistrer » l'exige). */
  fallbackName: string
}

/** Profil construit depuis le formulaire, ou `null` si les dimensions/décalages sont invalides. */
export function buildProfileFromForm(values: ProfileFormValues, options: BuildProfileOptions): PrintProfile | null {
  const offsetXMm = parseDecimal(values.offsetX)
  const offsetYMm = parseDecimal(values.offsetY)
  const gapMm = parseDecimal(values.gap)
  if (!Number.isFinite(offsetXMm) || !Number.isFinite(offsetYMm) || !Number.isFinite(gapMm)) return null
  try {
    const built = createPrintProfile({
      id: options.id,
      name: values.name.trim().slice(0, MAX_PROFILE_NAME_LENGTH) || options.fallbackName,
      kind: values.kind,
      ...(values.presetId === 'custom' ? { layout: layoutFromFields(values.kind, values.custom) } : { presetId: values.presetId }),
      offsetXMm,
      offsetYMm,
      dpi: values.dpi,
      gapMm,
      connection: values.connection,
      language: values.language,
      deviceId: values.device,
    })
    return sanitizeProfile(built)
  } catch {
    return null
  }
}
