import { currencyDecimals, roundHalfUp } from '../pricing'
import { resolveTaxCategory } from './resolveTax'
import type { LineTax, SaleTaxSummary, TaxContext, TaxableLine } from './types'

/**
 * ATTENTION : ce calcul existe aussi côté serveur (SaleLine). Les deux sont verrouillés par les cas partagés de
 * tax-golden-cases.json (TaxGoldenCasesTest côté Java, sharedTaxGolden.test.ts côté frontend) : changer la règle = changer ce fichier
 * et les deux côtés.
 *
 * TTC -> HT et part de TVA d'une ligne — miroir de SaleLine : le taux s'applique au HT (jamais TTC x taux), le HT est arrondi UNE
 * fois à la précision de la devise (HALF_UP, comme Money.divide) et la TVA est le reste (TTC - HT).
 *
 * Calcul en entiers (unités mineures x taux en centièmes de %) pour que les arrondis à .5 tombent exactement comme sur le
 * serveur (BigDecimal), sans dérive de flottants.
 */
export function extractTax(lineTotalTtc: number, ratePercent: number, decimals: number): { totalHt: number; taxAmount: number } {
  const factor = 10 ** decimals
  const sign = lineTotalTtc < 0 ? -1 : 1
  const ttcUnits = Math.round(Math.abs(lineTotalTtc) * factor)
  const rateHundredths = Math.round(ratePercent * 100) // NUMERIC(5, 2) côté serveur : 2 décimales au plus

  const numerator = ttcUnits * 10000
  const denominator = 10000 + rateHundredths
  const htUnits = Math.floor((2 * numerator + denominator) / (2 * denominator)) // HALF_UP sur des entiers

  return {
    totalHt: (sign * htUnits) / factor,
    taxAmount: (sign * (ttcUnits - htUnits)) / factor,
  }
}

/** TVA figée d'une ligne selon la cascade ; sans TVA applicable : HT = TTC et TVA = 0 (comme le serveur). */
export function lineTax(line: TaxableLine, ctx: TaxContext, decimals: number): LineTax {
  const resolved = resolveTaxCategory(ctx, line)
  if (!resolved || resolved.taxCategory.ratePercent === null) {
    return { taxCategoryId: null, ratePercent: null, totalHt: line.lineTotal, taxAmount: 0 }
  }
  const { totalHt, taxAmount } = extractTax(line.lineTotal, resolved.taxCategory.ratePercent, decimals)
  return { taxCategoryId: resolved.taxCategory.id, ratePercent: resolved.taxCategory.ratePercent, totalHt, taxAmount }
}

/**
 * Récapitulatif HT / TVA / TTC d'une vente, ligne par ligne. `null` quand aucune ligne n'a de TVA (boutique sans TVA, ou rien
 * d'applicable) : le ticket n'affiche alors aucun bloc de taxe, comme avec le récapitulatif serveur.
 *
 * @param currency devise de la vente — fixe la précision des arrondis (0 décimale en GNF/FCFA).
 */
export function summarizeSaleTax(lines: TaxableLine[], ctx: TaxContext, currency: string): SaleTaxSummary | null {
  const decimals = currencyDecimals(currency)
  const taxed = lines.map((line) => lineTax(line, ctx, decimals))
  if (!taxed.some((l) => l.ratePercent !== null)) return null

  const sum = (values: number[]) => roundHalfUp(values.reduce((acc, v) => acc + v, 0), decimals)
  const totalHt = sum(taxed.map((l) => l.totalHt))
  const totalTax = sum(taxed.map((l) => l.taxAmount))
  return { lines: taxed, totalHt, totalTax, totalTtc: sum(lines.map((l) => l.lineTotal)) }
}
