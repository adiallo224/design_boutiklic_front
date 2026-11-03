import { useState, useEffect, useCallback } from 'react'
import { DEFAULT_COST_METHOD, formatMoney, isCostMethod, type CostMethod } from '@boutiklic/shared'
import { authApi, type TenantResponse } from '../lib/authApi'
import { toErrorMessage } from '../lib/apiClient'
import { getDeviceId, getDeviceName, DEVICE_PLATFORM } from '../lib/device'
import { getActiveTenantId, persistSession, notifyAuthChanged, setLastKnownShop, AUTH_CHANGED_EVENT } from '../lib/session'

export interface Tenant {
  id: string
  name: string
  phone: string | null
  email: string | null
  currency: string
  city: string
  /** Pas éditée directement par ShopProfile (pas de champ dédié) — conservée pour ne pas l'écraser
   *  au prochain PATCH identity (updateIdentity remplace les 4 champs en bloc côté backend). */
  neighborhood: string | null
  logoUrl: string | null
  businessSector?: string
  shopSize: 'PETITE' | 'MOYENNE' | 'GRANDE'
  /** Pas encore exploité côté UI (pas de module facturation) — reflète TenantResponse.subscriptionType tel quel. */
  subscription: string
  /** Archivage du membership du compte courant sur cette boutique (pas la boutique elle-même) —
   *  cf. authApi.archiveBoutique/unarchiveBoutique, écran F0. */
  membershipActive: boolean
  /** Seuil (%) au-delà duquel un rabais accordé par un vendeur nécessite le relais gérant (écran F3). */
  discountApprovalThresholdPercent: number
  /** NIF, RCCM, clef d'immatriculation TVA — snapshottés sur chaque facture émise (doc TVA §3.4/§5). */
  taxId: string | null
  rccm: string | null
  vatRegistrationKey: string | null
  /** Plan Business (toggle admin/support uniquement, pas de self-service) — étude
   *  study/etude_multi_depots_transferts.md §7 phase 5. Débloque dépôts additionnels + transferts. */
  multiDepotEnabled: boolean
  /** Précision des prix de vente unitaires (0 à 2 décimales) — à utiliser pour les champs de prix de vente et l'affichage d'un
   *  prix unitaire ; la précision de la DEVISE (currencyDecimals) reste celle des montants encaissés. */
  sellingPriceDecimals: number
  /** Ce qu'un arrivage fait au coût d'achat des articles (étude prix décimaux, section 11) : MANUAL (défaut), LAST_PRICE ou
   *  WEIGHTED_AVERAGE. Réglage propriétaire. */
  costMethod: CostMethod
  /** TVA appliquée aux ventes (réglage propriétaire) et catégorie fiscale par défaut — dernier étage de la cascade article > catégorie > boutique. */
  taxEnabled: boolean
  defaultTaxCategoryId: string | null
  /** Code ISO du pays de la boutique (taux de TVA officiels) ; null tant qu'il n'est pas connu. */
  country: string | null
}

function emptyTenant(id: string): Tenant {
  return { id, name: '', phone: null, email: null, currency: 'GNF', city: '', neighborhood: null, logoUrl: null, shopSize: 'MOYENNE', subscription: 'GRATUIT', membershipActive: true, discountApprovalThresholdPercent: 20, taxId: null, rccm: null, vatRegistrationKey: null, multiDepotEnabled: false, sellingPriceDecimals: 0, costMethod: DEFAULT_COST_METHOD, taxEnabled: false, defaultTaxCategoryId: null, country: null }
}

function toTenant(response: TenantResponse, membershipActive = true): Tenant {
  return {
    id: response.id,
    name: response.name,
    phone: response.phone,
    email: response.email,
    currency: response.currency,
    city: response.city,
    neighborhood: response.neighborhood,
    logoUrl: response.logoUrl,
    businessSector: response.businessSector ?? undefined,
    shopSize: (response.shopSize as Tenant['shopSize']) ?? 'MOYENNE',
    subscription: response.subscriptionType,
    membershipActive,
    discountApprovalThresholdPercent: response.discountApprovalThresholdPercent,
    taxId: response.taxId,
    rccm: response.rccm,
    vatRegistrationKey: response.vatRegistrationKey,
    multiDepotEnabled: response.multiDepotEnabled,
    // Absent chez un serveur pas encore mis à jour : 0, le comportement historique.
    sellingPriceDecimals: response.sellingPriceDecimals ?? 0,
    // Absent chez un serveur pas encore mis à jour : MANUAL, le comportement historique.
    costMethod: isCostMethod(response.costMethod) ? response.costMethod : DEFAULT_COST_METHOD,
    taxEnabled: response.taxEnabled ?? false,
    defaultTaxCategoryId: response.defaultTaxCategoryId ?? null,
    country: response.country ?? null,
  }
}

/** Une seule boutique peut être active à la fois — bascule via `switchTenant` (écran F0, "Mes boutiques").
 * `tenants` liste toutes les boutiques du compte courant (même téléphone/email), active comprise —
 * cf. authApi.listMyBoutiques / identity ListMyBoutiquesUseCase. */
export function useTenant() {
  const [activeTenantId, setActiveTenantIdState] = useState<string>(() => getActiveTenantId() ?? '')
  const [tenant, setTenant] = useState<Tenant>(() => emptyTenant(activeTenantId))
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tenantsError, setTenantsError] = useState<string | null>(null)

  const load = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await authApi.getTenant(tenantId)
      setTenant(toTenant(response))
      // Repère local à ce terminal pour l'écran de connexion (cf. session.ts, lastKnownShop) — pas
      // de sens côté compte, donc pas transmis au serveur.
      setLastKnownShop({ id: response.id, name: response.name, city: response.city || null })
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  const loadAllTenants = useCallback(async () => {
    setTenantsError(null)
    try {
      const memberships = await authApi.listMyBoutiques()
      const responses = await Promise.all(memberships.map((m) => authApi.getTenant(m.tenantId).catch(() => null)))
      const loaded = responses
        .map((r, i) => (r ? toTenant(r, memberships[i].active) : null))
        .filter((t): t is Tenant => t !== null)
      setTenants(loaded)
    } catch (e) {
      // Non bloquant : la boutique active (tenant) reste affichable même si la liste échoue à charger,
      // mais l'erreur doit rester visible (cf. écran F0, "Mes boutiques") plutôt que masquée en 0 résultat.
      setTenants([])
      setTenantsError(toErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    load(activeTenantId)
    loadAllTenants()
  }, [activeTenantId, load, loadAllTenants])

  useEffect(() => {
    const onAuthChanged = () => {
      const currentId = getActiveTenantId() ?? ''
      setActiveTenantIdState((prev) => (prev === currentId ? prev : currentId))
    }
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
  }, [])

  const switchTenant = useCallback(async (id: string) => {
    if (id === activeTenantId) return
    setError(null)
    try {
      const session = await authApi.switchBoutique(id, {
        deviceId: getDeviceId(),
        deviceName: getDeviceName(),
        platform: DEVICE_PLATFORM,
      })
      persistSession(session, id)
      notifyAuthChanged()
      setActiveTenantIdState(id)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [activeTenantId])

  const archiveTenant = useCallback(async (id: string) => {
    setError(null)
    try {
      await authApi.archiveBoutique(id)
      await loadAllTenants()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [loadAllTenants])

  const unarchiveTenant = useCallback(async (id: string) => {
    setError(null)
    try {
      await authApi.unarchiveBoutique(id)
      await loadAllTenants()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [loadAllTenants])

  // Un seul formateur de montants pour toute l'app (packages/shared/src/pricing.ts) : précision de la devise du tenant,
  // fr-FR comme avant. Les 90 écrans qui appellent formatCurrency n'ont rien à changer.
  const formatCurrency = (amount: number) => formatMoney(amount, tenant.currency)

  // Prix de vente UNITAIRE avec sa devise, à la précision des prix de vente de la boutique (pas de la devise) : « 333,33 GNF ».
  const formatUnitPrice = (amount: number) => formatMoney(amount, tenant.currency, 'fr', tenant.sellingPriceDecimals)

  return {
    tenant,
    tenants,
    activeTenantId,
    switchTenant,
    archiveTenant,
    unarchiveTenant,
    formatCurrency,
    formatUnitPrice,
    isLoading,
    error,
    tenantsError,
    refetch: () => {
      load(activeTenantId)
      loadAllTenants()
    },
  }
}
