import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { AUTO_LOCK_NEVER, getAutoLockMinutes } from '../lib/autoLock'

const ACTIVITY_KEY = 'boutiklic_last_activity'
const CHECK_INTERVAL_MS = 15_000

/** Verrouillage auto (écran Sécurité, A4) — pas d'équivalent RN à visibilitychange/DOM activity
 * events : la dernière activité est persistée en AsyncStorage et le retard rattrapé sur le retour
 * au premier plan (AppState), mirror du principe web (localStorage + visibilitychange/focus). */
export function useIdleTimer(enabled: boolean): { locked: boolean; unlock: () => void; bumpActivity: () => void } {
  const [locked, setLocked] = useState(false)
  const lockedRef = useRef(locked)
  lockedRef.current = locked

  const bumpActivity = useCallback(() => {
    if (lockedRef.current) return
    AsyncStorage.setItem(ACTIVITY_KEY, String(Date.now()))
  }, [])

  const checkIdle = useCallback(async () => {
    const minutes = await getAutoLockMinutes()
    if (minutes === AUTO_LOCK_NEVER) return
    const raw = await AsyncStorage.getItem(ACTIVITY_KEY)
    const last = Number(raw) || Date.now()
    if (Date.now() - last >= minutes * 60_000) setLocked(true)
  }, [])

  useEffect(() => {
    if (!enabled) return
    bumpActivity()
    checkIdle()

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkIdle()
    })
    const interval = setInterval(checkIdle, CHECK_INTERVAL_MS)

    return () => {
      subscription.remove()
      clearInterval(interval)
    }
  }, [enabled, bumpActivity, checkIdle])

  const unlock = useCallback(() => {
    bumpActivity()
    setLocked(false)
  }, [bumpActivity])

  return { locked, unlock, bumpActivity }
}
