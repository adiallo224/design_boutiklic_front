import { useCallback, useEffect, useState } from 'react'
import { isTauri } from '@tauri-apps/api/core'
import type { Update } from '@tauri-apps/plugin-updater'
import { apiClient } from '../../lib/apiClient'
import { getAccessToken, getActiveTenantId } from '../../lib/session'

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000

/** Réponse de GET /desktop/updates/... — {@code mandatory} : l'app est sous la version minimale supportée. */
interface OfferedUpdate {
  mandatory: boolean
}

export type AppUpdateStatus = 'idle' | 'installing' | 'error'

/** Vérifie les mises à jour de l'app desktop (plugin updater Tauri) au démarrage puis toutes les
 *  4 h. Sans réseau ou sans manifeste publié, la vérification échoue en silence : l'app est
 *  offline-first, une mise à jour ne doit jamais gêner la vente. Le backend décide de la version
 *  proposée selon l'abonnement de la boutique (endpoint configuré dans tauri.conf.json, authentifié par
 *  le JWT) : on sonde d'abord la même route via apiClient, qui rafraîchit au besoin un token expiré
 *  et évite de lancer le plugin quand il n'y a rien à installer (204). L'installation n'est jamais
 *  automatique — l'utilisateur choisit le moment (redémarrage = fermeture de la caisse). */
export function useAppUpdate() {
  const [update, setUpdate] = useState<Update | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [mandatory, setMandatory] = useState(false)
  const [status, setStatus] = useState<AppUpdateStatus>('idle')

  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    const check = async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app')
        const offered = await apiClient.get<OfferedUpdate | undefined>(`/desktop/updates/windows/x86_64/${await getVersion()}`)
        if (!offered) return
        const { check } = await import('@tauri-apps/plugin-updater')
        const token = getAccessToken()
        const tenantId = getActiveTenantId()
        const found = await check({
          headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}) },
        })
        if (!cancelled && found) {
          setUpdate(found)
          setMandatory(offered.mandatory)
        }
      } catch {
        // hors-ligne / pas de manifeste : on réessaiera au prochain cycle
      }
    }
    void check()
    const id = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  const install = useCallback(async () => {
    if (!update) return
    setStatus('installing')
    try {
      await update.downloadAndInstall()
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch {
      setStatus('error')
    }
  }, [update])

  const dismiss = useCallback(() => setDismissed(true), [])

  // Une mise à jour obligatoire ne peut pas être repoussée (l'ancienne version ne parle plus à l'API).
  return { update: dismissed && !mandatory ? null : update, mandatory, status, install, dismiss }
}
