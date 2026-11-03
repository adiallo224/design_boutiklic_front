/**
 * TVA hors ligne — miroir côté client de boutiklic-core (module tax + SaleLine). Le serveur reste SEUL autoritaire : il
 * résout et fige le taux de chaque ligne à la synchronisation. Ce module sert à AFFICHER la TVA quand l'appareil n'a pas
 * le réseau (ticket d'une vente mise en file) et à décrire la cascade « d'où vient le taux » dans les écrans de réglage.
 */

/** Taux en vigueur d'une catégorie fiscale (module tax) — `ratePercent` null = aucune règle en vigueur : pas de TVA. */
export interface TaxCategoryRate {
  id: string
  name: string
  ratePercent: number | null
}

/** Nœud de l'arbre des catégories d'articles, réduit à ce que la cascade lit. */
export interface TaxCategoryNode {
  id: string
  parentId: string | null
  /** TVA propre à la catégorie ; absent/null = hérite du parent, puis de la boutique. */
  taxCategoryId?: string | null
}

/** Tout ce qu'il faut savoir d'une boutique pour résoudre la TVA sans réseau. */
export interface TaxContext {
  /** Interrupteur de la boutique : faux = aucune TVA, quoi qu'il y ait sur l'article ou sa catégorie. */
  enabled: boolean
  /** Dernier étage de la cascade : catégorie fiscale par défaut de la boutique. */
  defaultTaxCategoryId: string | null
  taxCategories: TaxCategoryRate[]
  categories: TaxCategoryNode[]
}

/** D'où vient la catégorie fiscale retenue : l'article lui-même, sa catégorie (ou un parent), ou la boutique. */
export type TaxSource = 'product' | 'category' | 'shop'

export interface ResolvedTax {
  source: TaxSource
  taxCategory: TaxCategoryRate
}

/** Ce que la cascade lit sur un article / une ligne de vente. */
export interface TaxSubject {
  /** Catégorie fiscale propre à l'article (étage 1). */
  taxCategoryId?: string | null
  /** Catégorie d'articles (étage 2, en remontant les parents). */
  categoryId?: string | null
}

export interface TaxableLine extends TaxSubject {
  /** Total TTC de la ligne, déjà arrondi à la précision de la devise. */
  lineTotal: number
}

/** TVA figée d'une ligne. `taxCategoryId`/`ratePercent` null = ligne sans TVA (HT = TTC). */
export interface LineTax {
  taxCategoryId: string | null
  ratePercent: number | null
  totalHt: number
  taxAmount: number
}

export interface SaleTaxSummary {
  lines: LineTax[]
  totalHt: number
  totalTax: number
  totalTtc: number
}
