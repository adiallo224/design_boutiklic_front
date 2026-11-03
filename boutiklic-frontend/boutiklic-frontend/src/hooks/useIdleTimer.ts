import { useCallback, useEffect, useState } from 'react'
import { AUTO_LOCK_NEVER, getAutoLockMinutes } from '../lib/autoLock'

const ACTIVITY_KEY = 'boutiklic_last_activity'
const CHECK_INTERVAL_MS = 15_000
const ACTIVITY_EVENTS = ['mousemove', 'keydown', 'touchstart', 'click'] as const

/** Verrouillage auto (écran Sécurité, A4) — un `setTimeout` seul serait suspendu quand l'app PWA est
 * backgroundée (pas de tâche de fond dans le service worker) : la dernière activité est donc persistée
 * en localStorage et le retard rattrapé sur `visibilitychange`/`focus`, pas seulement via l'intervalle. */
export function useIdleTimer(enabled: boolean): { locked: boolean; unlock: () => void } {
  const [locked, setLocked] = useState(false)

  const bumpActivity = useCallback(() => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  }, [])

  const checkIdle = useCallback(() => {
    const minutes = getAutoLockMinutes()
    if (minutes === AUTO_LOCK_NEVER) return
    const last = Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now()
    if (Date.now() - last >= minutes * 60_000) {
      setLocked(true)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    bumpActivity()
    checkIdle()

    // Tant que verrouillé, une activité sur l'écran de verrouillage (saisie du mot de passe) ne doit
    // pas repousser silencieusement l'expiration — seul unlock() (succès du mot de passe) le fait.
    const onActivity = () => { if (!locked) bumpActivity() }
    const onVisibility = () => { if (document.visibilityState === 'visible') checkIdle() }

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity))
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('focus', onVisibility)
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity))
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('focus', onVisibility)
      clearInterval(interval)
    }
  }, [enabled, locked, bumpActivity, checkIdle])

  const unlock = useCallback(() => {
    bumpActivity()
    setLocked(false)
  }, [bumpActivity])

  return { locked, unlock }
}
