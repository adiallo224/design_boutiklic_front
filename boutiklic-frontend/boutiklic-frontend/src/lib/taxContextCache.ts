import type { TaxContext } from '@boutiklic/shared'
import { taxApi } from './taxApi'
import type { CategoryResponse } from './categoriesApi'

/**
 * TVA hors ligne : instantané des données dont le calcul a besoin (taux en vigueur, arbre des catégories avec leur TVA propre,
 * interrupteur et défaut de la boutique), rafraîchi à chaque passage en ligne de la caisse. Même esprit que lib/stockCache.ts —
 * une estimation lue sur l'appareil, le serveur restant seul autoritaire à la synchronisation. Scopé par boutique : le taux d'une
 * autre boutique ne doit jamais servir.
 */

const KEY = 'boutiklic_tax_context'

interface StoredTaxContext {
  tenantId: string
  at: string
  context: TaxContext
}

export function cacheTaxContext(tenantId: string, context: TaxContext): void {
  try {
    const stored: StoredTaxContext = { tenantId, at: new Date().toISOString(), context }
    localStorage.setItem(KEY, JSON.stringify(stored))
  } catch {
    // Stockage plein ou indisponible : la caisse fonctionne, seule l'estimation de TVA hors ligne est perdue.
  }
}

/** Dernier instantané connu de CETTE boutique, ou null (jamais en ligne sur cet appareil, ou autre boutique). */
export function getCachedTaxContext(tenantId: string): TaxContext | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const stored = JSON.parse(raw) as StoredTaxContext
    return stored.tenantId === tenantId ? stored.context : null
  } catch {
    return null
  }
}

/** Boutique telle que `useTenant` l'expose — seuls les champs fiscaux comptent ici. */
export interface TaxContextTenant {
  id: string
  taxEnabled: boolean
  defaultTaxCategoryId: string | null
}

/** Relit les taux auprès du serveur et rafraîchit l'instantané. Hors ligne ou en erreur, l'instantané précédent est conservé. */
export async function refreshTaxContext(tenant: TaxContextTenant, categories: CategoryResponse[]): Promise<TaxContext | null> {
  try {
    const taxCategories = await taxApi.getActiveCategories()
    const context: TaxContext = {
      enabled: tenant.taxEnabled,
      defaultTaxCategoryId: tenant.defaultTaxCategoryId,
      taxCategories: taxCategories.map((c) => ({ id: c.id, name: c.name, ratePercent: c.ratePercent })),
      categories: categories.map((c) => ({ id: c.id, parentId: c.parentId, taxCategoryId: c.taxCategoryId })),
    }
    cacheTaxContext(tenant.id, context)
    return context
  } catch {
    return getCachedTaxContext(tenant.id)
  }
}
