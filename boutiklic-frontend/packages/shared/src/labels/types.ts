import type { Locale } from '../locale'

export type BarcodeSymbology = 'EAN13' | 'CODE128'

/** Résultat d'encodage : `modules` est la suite de modules ('1' = barre, '0' = espace), guards inclus,
 *  sans zone de silence (ajoutée par le rendu, cf. `quietZoneModules`). */
export interface BarcodeEncoding {
  symbology: BarcodeSymbology
  /** Valeur encodée (chaîne que la caisse retrouvera au scan). */
  value: string
  modules: string
  /** Texte lisible affiché sous les barres (EAN-13 : « 4 006381 333931 »). */
  humanReadable: string
  quietZoneModules: number
}

/** Étiquette à imprimer — modèle neutre, indépendant du matériel (cf. étude §3.4). */
export interface LabelModel {
  productId: string
  name: string
  /** Prix TTC (convention du projet : `salePrice` est TTC). */
  price: number
  currency: string
  /** Prix avant promotion — renseigné seulement si une promo s'applique (cf. `resolvePrice`). */
  previousPrice?: number | null
  /** Code-barres de l'article ; absent → étiquette de prix sans code. */
  barcode?: string | null
  categoryName?: string | null
  /** Nombre d'exemplaires (≥ 0). */
  copies: number
}

export interface LabelContentOptions {
  showBarcode: boolean
  showShopName: boolean
  shopName?: string
  showCategory: boolean
  /** Traits de coupe autour de chaque étiquette (papier ordinaire découpé). */
  showCutMarks: boolean
  /** Nombre de cases à laisser vides au début de la 1ʳᵉ page (réutiliser une planche entamée). */
  startIndex: number
  locale: Locale
  /** Titre du document HTML (onglet / nom du travail d'impression). */
  title?: string
}

export const DEFAULT_CONTENT_OPTIONS: LabelContentOptions = {
  showBarcode: true,
  showShopName: false,
  showCategory: false,
  showCutMarks: false,
  startIndex: 0,
  locale: 'fr',
}

/** Grille d'étiquettes sur une page (A4) ou une étiquette = une page (rouleau thermique). Tout en mm. */
export interface LabelLayout {
  pageWidthMm: number
  pageHeightMm: number
  columns: number
  rows: number
  marginLeftMm: number
  marginTopMm: number
  gutterXMm: number
  gutterYMm: number
  cellWidthMm: number
  cellHeightMm: number
  /** Remplissage interne de chaque case : protège de la marge non imprimable des imprimantes. */
  paddingMm: number
}

export type PrinterKind = 'SHEET_A4' | 'THERMAL_ROLL'
export type PrintConnection = 'SYSTEM_DIALOG' | 'USB_RAW' | 'NETWORK' | 'BLUETOOTH'
export type PrintLanguage = 'HTML' | 'TSPL' | 'ZPL'

/** Profil d'impression propre à un appareil (jamais synchronisé, cf. étude §3.3). */
export interface PrintProfile {
  id: string
  name: string
  kind: PrinterKind
  /** Id de préréglage (`a4-full`, `roll-50x30`…) ou `custom`. */
  presetId: string
  layout: LabelLayout
  /** Calage : décalage appliqué à toute la grille (les imprimantes dérivent). */
  offsetXMm: number
  offsetYMm: number
  /** Résolution de l'imprimante — sert à caler la largeur des barres sur un nombre entier de points. */
  dpi: number
  /** Intervalle entre deux étiquettes du rouleau (mm) — lu par TSPL (`GAP`) ; sans effet pour le dialogue système. */
  gapMm: number
  connection: PrintConnection
  language: PrintLanguage
  /** Adresse/identifiant de l'imprimante (connexions directes uniquement). */
  deviceId?: string | null
}

export type LabelIssueKind =
  | 'NO_BARCODE'
  | 'UNENCODABLE_BARCODE'
  | 'DUPLICATE_BARCODE'
  | 'BARCODE_TOO_SMALL'
  | 'INVALID_PRICE'
  | 'NO_COPIES'

export interface LabelIssue {
  productId: string
  kind: LabelIssueKind
  barcode?: string
}

export interface LabelsDocument {
  html: string
  pageCount: number
  /** Nombre d'étiquettes réellement dessinées (copies comprises). */
  labelCount: number
  issues: LabelIssue[]
}
