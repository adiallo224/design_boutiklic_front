import { A4_PRESETS, ROLL_PRESETS, labelsPerPage, layoutForPreset } from './layouts'
import type { LabelLayout, PrinterKind } from './types'

/** Fonction de traduction minimale (le `t` de react-i18next y est compatible) — le package partagé ne dépend pas d'i18next. */
export type Translate = (key: string, options?: Record<string, unknown>) => string

/** 74.25 → « 74,25 », 105 → « 105 » (pas de zéros inutiles). */
export function formatMm(value: number): string {
  return String(Number(value.toFixed(2))).replace('.', ',')
}

export interface FormatOption {
  id: string
  /** « A6 (¼ A4) — 105 × 148,5 mm » */
  label: string
  /** Usage recommandé (liste des formats A4), absent pour le personnalisé. */
  usage?: string
}

/** Libellé lisible d'un préréglage : nom traduit + dimensions d'une étiquette (clés `labels.presets.*`). */
export function presetLabel(t: Translate, presetId: string): string {
  const name = t(`labels.presets.${presetId}`)
  const layout = layoutForPreset(presetId)
  return layout ? `${name} — ${formatMm(layout.cellWidthMm)} × ${formatMm(layout.cellHeightMm)} mm` : name
}

/** Formats proposés pour un type d'imprimante ; « Personnalisé » seulement si `includeCustom`. */
export function formatOptions(t: Translate, kind: PrinterKind, includeCustom: boolean): FormatOption[] {
  const options: FormatOption[] =
    kind === 'SHEET_A4'
      ? A4_PRESETS.map((p) => ({ id: p.id, label: presetLabel(t, p.id), usage: t(`labels.families.${p.family}`) }))
      : ROLL_PRESETS.map((p) => ({ id: p.id, label: presetLabel(t, p.id), usage: t('labels.families.roll') }))
  if (includeCustom) options.push({ id: 'custom', label: t('labels.presets.custom'), usage: t('labels.families.custom') })
  return options
}

export function perPageLabel(t: Translate, layout: LabelLayout): string {
  return t('labels.profiles.perPage', { count: labelsPerPage(layout) })
}

/** Résolutions proposées ; on ajoute la valeur courante si elle n'est pas dans la liste (profil importé/ancien). */
export function dpiOptions(kind: PrinterKind, current: number): number[] {
  const base = kind === 'SHEET_A4' ? [300, 600] : [203, 300]
  return base.includes(current) ? base : [...base, current].sort((a, b) => a - b)
}
