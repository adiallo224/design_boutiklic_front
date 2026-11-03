import type { PlanResponse } from './subscriptionApi'

/** Limites affichées. Sites et commandes en ligne n'ont de sens que si l'offre inclut la vente en ligne. */
export const COMPARED_QUOTAS = ['MAX_PRODUCTS', 'MAX_STOREFRONTS', 'MAX_ORDERS_PER_MONTH', 'MAX_DEPOTS'] as const
export type ComparedQuota = (typeof COMPARED_QUOTAS)[number]
const ONLINE_QUOTAS: ComparedQuota[] = ['MAX_STOREFRONTS', 'MAX_ORDERS_PER_MONTH']

export interface LimitChange {
  quota: ComparedQuota
  /** null = illimité */
  from: number | null
  to: number | null
  /** Vrai si la nouvelle limite est plus basse (ou n'est plus illimitée). */
  worse: boolean
}

export interface PlanChange {
  gained: string[]
  lost: string[]
  limits: LimitChange[]
  /** Faux = même contenu : rien ne change pour la boutique. */
  hasChanges: boolean
  /** Vrai si l'on perd une fonctionnalité ou si une limite baisse. */
  isDowngrade: boolean
}

export interface Rights {
  features: string[]
  limits: Record<string, number>
}

/** Une limite n'est comparée que si la vente en ligne est incluse (sinon « illimité » n'aurait aucun sens : la fonction n'existe pas). */
function relevantQuotas(rights: Rights): ComparedQuota[] {
  return COMPARED_QUOTAS.filter((q) => !ONLINE_QUOTAS.includes(q) || rights.features.includes('ONLINE_STORE'))
}

/** Ce que gagne et perd une boutique qui a `current` en passant à `target`. */
export function comparePlans(current: Rights, target: Pick<PlanResponse, 'features' | 'limits'>): PlanChange {
  const gained = target.features.filter((f) => !current.features.includes(f))
  const lost = current.features.filter((f) => !target.features.includes(f))
  const comparable = relevantQuotas(current).filter((q) => relevantQuotas(target).includes(q))
  const limits: LimitChange[] = []
  for (const quota of comparable) {
    const from = current.limits[quota] ?? null
    const to = target.limits[quota] ?? null
    if (from === to) continue
    limits.push({ quota, from, to, worse: to !== null && (from === null || to < from) })
  }
  return { gained, lost, limits, hasChanges: gained.length + lost.length + limits.length > 0, isDowngrade: lost.length > 0 || limits.some((l) => l.worse) }
}

/** Limites d'une offre à afficher (même règle : pas de sites ni de commandes sans vente en ligne), `null` = illimité. */
export function displayedLimits(plan: Pick<PlanResponse, 'features' | 'limits'>): { quota: ComparedQuota; value: number | null }[] {
  return relevantQuotas(plan).map((quota) => ({ quota, value: plan.limits[quota] ?? null }))
}
