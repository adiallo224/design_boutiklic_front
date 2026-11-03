import { formatNumber } from './formatting'
import { DEFAULT_LOCALE, type Locale } from './locale'

/**
 * Coût unitaire et conditionnement (lot -> unités) — miroir côté client de boutiklic-core
 * (shared/domain/valueobject/UnitCost + Product.unitCost(), étude study/etude_prix_decimaux.md, phases 1-2).
 *
 * Ces fonctions servent à AFFICHER en direct le coût pendant la saisie. Le serveur reste seul autoritaire : avec
 * un lot il dérive lui-même le prix d'achat, la quantité et le total, et ignore ce que le client envoie.
 */

/** Décimales conservées sur un coût — aligné sur UnitCost.SCALE côté serveur (NUMERIC(19, 6)). */
export const UNIT_COST_SCALE = 6

/** Arrondi commercial (HALF_UP) à `decimals` décimales — comme Money côté serveur (0 décimale en GNF/FCFA).
 *  Les montants sont positifs ici : Math.round (qui arrondit .5 vers le haut) suffit. */
export function roundHalfUp(value: number, decimals = 0): number {
  const factor = 10 ** decimals
  return Math.round((value + Number.EPSILON) * factor) / factor
}

/** Coût d'une unité achetée en lot : prix du lot / unités par lot, à 6 décimales, jamais arrondi à la devise
 *  (1 000 pour 3 boîtes = 333,333333). 0 si le lot est invalide (pas de division par zéro). */
export function unitCostFromPack(packPrice: number, unitsPerPack: number): number {
  if (!(unitsPerPack > 0) || !(packPrice >= 0)) return 0
  return roundHalfUp(packPrice / unitsPerPack, UNIT_COST_SCALE)
}

export interface PackPricedProduct {
  purchasePrice: number
  packSize?: number | null
  packPurchasePrice?: number | null
  /** Coût exact stocké par le serveur (6 décimales). Prioritaire : une méthode de coût (dernier prix, moyenne pondérée) peut le
   *  fixer à une valeur que ni le lot ni le prix d'achat arrondi ne permettent de retrouver. Absent = pas encore connu. */
  unitCost?: number | null
}

/** Coût unitaire EXACT d'un article : celui stocké par le serveur s'il est connu, sinon issu du lot, sinon son prix d'achat
 *  (réplique ou serveur antérieurs à la phase 7). */
export function effectiveUnitCost(product: PackPricedProduct): number {
  if (typeof product.unitCost === 'number' && Number.isFinite(product.unitCost)) return product.unitCost
  return product.packSize != null && product.packPurchasePrice != null
    ? unitCostFromPack(product.packPurchasePrice, product.packSize)
    : product.purchasePrice
}

export interface IntakeLineAmounts {
  quantity: number
  unitPurchasePrice: number
  packCount?: number | null
  unitsPerPack?: number | null
  packPrice?: number | null
}

/** Méthodes de coût d'une boutique — miroir de CostMethod.java (étude prix décimaux, section 11) : ce qu'un arrivage fait au coût
 *  d'achat des articles. MANUAL (défaut) : rien. LAST_PRICE : le coût devient celui de l'arrivage. WEIGHTED_AVERAGE : moyenne pondérée
 *  par les quantités avec le stock actuel. */
export const COST_METHODS = ['MANUAL', 'LAST_PRICE', 'WEIGHTED_AVERAGE'] as const
export type CostMethod = (typeof COST_METHODS)[number]
export const DEFAULT_COST_METHOD: CostMethod = 'MANUAL'

export function isCostMethod(value: unknown): value is CostMethod {
  return typeof value === 'string' && (COST_METHODS as readonly string[]).includes(value)
}

/** Coût unitaire EXACT d'une ligne d'arrivage : prix du lot / unités par lot pour une ligne par lot, sinon le prix unitaire saisi
 *  (déjà arrondi à la devise : seul un lot porte un coût plus précis). */
export function intakeLineUnitCost(line: IntakeLineAmounts): number {
  return line.packPrice != null && line.unitsPerPack != null
    ? unitCostFromPack(line.packPrice, line.unitsPerPack)
    : line.unitPurchasePrice
}

/** En méthode MANUELLE, le coût d'un arrivage n'est jamais appliqué à la fiche de l'article : faut-il prévenir l'utilisateur que le
 *  coût de cette ligne diffère de celui de la fiche ? Comparaison à la précision d'affichage (2 décimales), pour ne pas signaler un
 *  écart invisible. Toute autre méthode (ou méthode inconnue d'un serveur ancien) : jamais. */
export function intakeCostIgnored(method: string | undefined, lineUnitCost: number, sheetUnitCost: number): boolean {
  return method === 'MANUAL' && roundHalfUp(lineUnitCost, 2) !== roundHalfUp(sheetUnitCost, 2)
}

/** Total d'une ligne d'arrivage. Par lot : nombre de lots × prix du lot, EXACT — jamais unités × prix unitaire
 *  arrondi, qui ferait perdre un franc par lot (3 boîtes à 333 = 999 alors que le lot a coûté 1 000). */
export function intakeLineTotal(line: IntakeLineAmounts): number {
  return line.packCount != null && line.packPrice != null
    ? line.packCount * line.packPrice
    : line.quantity * line.unitPurchasePrice
}

/** Affichage d'un coût unitaire : jusqu'à 2 décimales (333,33), sans zéros inutiles (350 reste 350). Le
 *  formatage monétaire courant (0 décimale) arrondirait un coût à 333 et cacherait la précision. */
export function formatUnitCost(value: number, locale: Locale): string {
  return formatNumber(value, locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

// ---------------------------------------------------------------------------------------------------------------
// Montants encaissés : précision de la devise, affichage et saisie (étude prix décimaux, phase 5)
// ---------------------------------------------------------------------------------------------------------------

/** Décimales de chaque devise — miroir de `Currency.decimalPlaces()` côté serveur (boutiklic-core). À aligner dès qu'une
 *  devise est ajoutée côté serveur (ex. EUR = 2) : c'est la seule source de vérité côté client. */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  GNF: 0,
  FCFA: 0,
  SLE: 2,
  LRD: 2,
  GHS: 2,
  NGN: 2,
  GMD: 2,
  CVE: 2,
  DZD: 2,
  AOA: 2,
  BWP: 2,
  BIF: 0,
  KMF: 0,
  CDF: 0,
  DJF: 0,
  EGP: 2,
  ERN: 2,
  SZL: 2,
  ETB: 2,
  KES: 2,
  LSL: 2,
  LYD: 2,
  MGA: 0,
  MWK: 0,
  MUR: 2,
  MRU: 2,
  MAD: 2,
  MZN: 2,
  NAD: 2,
  UGX: 0,
  RWF: 0,
  STN: 2,
  SCR: 2,
  SOS: 0,
  SDG: 0,
  SSP: 0,
  ZAR: 2,
  TZS: 0,
  TND: 2,
  ZMW: 2,
  ZWG: 2,
}

/** Nombre de décimales d'un montant encaissé dans cette devise. 0 pour une devise inconnue (comportement historique). */
export function currencyDecimals(currency: string): number {
  return CURRENCY_DECIMALS[currency] ?? 0
}

/**
 * Montant affiché avec sa devise, à la précision de la devise (ou de `decimals` si fourni — ex. la précision des prix de
 * vente réglable par boutique, phase 5bis). Remplace les formateurs dupliqués de `useTenant` (web et mobile).
 * `locale` vaut 'fr' par défaut, comme le formateur historique (fr-FR : espace fine comme séparateur de milliers).
 */
export function formatMoney(
  amount: number,
  currency: string,
  locale: Locale = DEFAULT_LOCALE,
  decimals: number = currencyDecimals(currency),
): string {
  return `${formatNumber(amount, locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })} ${currency}`
}

/**
 * Nettoie ce que tape (ou colle) l'utilisateur dans un champ de montant et renvoie la forme canonique (point décimal).
 *
 * - `decimals` = 0 : uniquement les chiffres, exactement comme l'ancien `replace(/[^0-9]/g, '')` — un collage « 1.000.000 »
 *   ou « 1 000 » donne toujours 1000000 / 1000 (aucun changement de comportement pour les devises sans décimale).
 * - `decimals` > 0 : virgule ou point acceptés comme séparateur décimal (le premier seul compte), partie décimale tronquée
 *   à `decimals` chiffres, « .5 » devient « 0.5 » ; une saisie en cours (« 12. ») est conservée pour pouvoir continuer.
 */
export function sanitizeMoneyInput(raw: string, decimals: number): string {
  // !(decimals > 0) et non decimals <= 0 : une précision absente ou invalide (undefined, NaN) retombe sur le mode entiers historique.
  if (!(decimals > 0)) return raw.replace(/\D/g, '')
  const cleaned = raw.replace(/,/g, '.').replace(/[^0-9.]/g, '')
  const dot = cleaned.indexOf('.')
  if (dot === -1) return cleaned
  const integerPart = cleaned.slice(0, dot) || '0'
  const fractionPart = cleaned.slice(dot + 1).replace(/\./g, '').slice(0, decimals)
  return `${integerPart}.${fractionPart}`
}

/** Valeur numérique d'une saisie de montant (déjà nettoyée ou non) — 0 si vide ou invalide, jamais NaN. */
export function parseMoneyInput(value: string): number {
  const parsed = Number(value.replace(/,/g, '.'))
  return Number.isFinite(parsed) ? parsed : 0
}

// ---------------------------------------------------------------------------------------------------------------
// Prix de vente unitaires décimaux (étude prix décimaux, phase 5bis)
// ---------------------------------------------------------------------------------------------------------------

/**
 * Montant dû pour `quantity` unités d'un prix unitaire : prix × quantité, arrondi UNE fois à la précision de la DEVISE —
 * miroir de `UnitPrice.times` côté serveur (chaque ligne est arrondie, le total de la vente est la somme des lignes arrondies,
 * comme une facture papier). Calculé en centimes entiers : un prix unitaire a au plus 2 décimales, donc aucune dérive de
 * flottant (333,33 × 3 donne 1000 en GNF, pas 999,9899999…).
 */
export function unitPriceLineTotal(unitPrice: number, quantity: number, currencyDecimalsCount = 0): number {
  const cents = Math.round(unitPrice * 100) * quantity
  const centsPerCurrencyUnit = 10 ** (2 - currencyDecimalsCount)
  return Math.round(cents / centsPerCurrencyUnit) / 10 ** currencyDecimalsCount
}

/** Prix de vente unitaire SANS devise (grille de caisse, listes) à la précision des prix de vente de la boutique — toujours le
 *  même nombre de décimales (« 400,00 » et « 333,33 »), pour qu'une colonne de prix reste alignée. */
export function formatSellingPrice(value: number, locale: Locale, decimals: number): string {
  return formatNumber(value, locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
