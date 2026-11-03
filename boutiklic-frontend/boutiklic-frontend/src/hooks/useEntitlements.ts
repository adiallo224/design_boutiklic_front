import { useCallback, useEffect, useReducer, useState } from 'react'
import { entitlementsApi, type Entitlements, type Feature, type Quota } from '../lib/entitlementsApi'
import { AUTH_CHANGED_EVENT, getActiveTenantId } from '../lib/session'

/** Cache du processus, par boutique : le menu et chaque écran interrogent le même résultat, un seul appel réseau. */
let cached: { tenantId: string; value: Entitlements } | null = null
let inflight: { tenantId: string; promise: Promise<Entitlements> } | null = null

/** Oublie ce qui a été lu (changement d'offre, tests). */
export function resetEntitlementsCache() {
  cached = null
  inflight = null
}

function load(tenantId: string): Promise<Entitlements> {
  if (inflight && inflight.tenantId === tenantId) return inflight.promise
  const promise = entitlementsApi
    .get()
    .then((value) => {
      cached = { tenantId, value }
      return value
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null
    })
  inflight = { tenantId, promise }
  return promise
}

export interface EntitlementsState {
  /** Faux tant que la réponse n'est pas arrivée (ne pas afficher « non inclus » à ce moment-là). */
  loaded: boolean
  /** Lecture impossible (hors ligne, serveur indisponible): on ne montre PAS les fonctions soumises à l'offre, sans bloquer le reste de l'application. */
  error: boolean
  has: (feature: Feature) => boolean
  /** Limite chiffrée, ou null si illimitée (ou inconnue). */
  limit: (quota: Quota) => number | null
  refresh: () => void
}

/** Droits de l'offre de la boutique active. Un changement de boutique ou de session relit les droits. */
export function useEntitlements(): EntitlementsState {
  const [, bump] = useReducer((n: number) => n + 1, 0)
  const tenantId = getActiveTenantId() ?? ''
  const [value, setValue] = useState<Entitlements | null>(() => (cached && cached.tenantId === tenantId ? cached.value : null))
  const [error, setError] = useState(false)

  useEffect(() => {
    window.addEventListener(AUTH_CHANGED_EVENT, bump)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, bump)
  }, [])

  const fetchNow = useCallback(
    (force: boolean) => {
      if (!tenantId) return
      if (force) cached = null
      if (cached && cached.tenantId === tenantId) {
        setValue(cached.value)
        return
      }
      setValue(null)
      setError(false)
      let active = true
      load(tenantId)
        .then((v) => active && setValue(v))
        .catch(() => active && setError(true))
      return () => {
        active = false
      }
    },
    [tenantId],
  )

  useEffect(() => fetchNow(false), [fetchNow])

  return {
    loaded: value !== null || error,
    error,
    has: (feature) => value?.features.includes(feature) ?? false,
    limit: (quota) => value?.limits[quota] ?? null,
    refresh: () => void fetchNow(true),
  }
}
