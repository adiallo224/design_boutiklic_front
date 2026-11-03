import AsyncStorage from '@react-native-async-storage/async-storage'

/** 0 = aucun verrouillage automatique. */
export const AUTO_LOCK_NEVER = 0

export const AUTO_LOCK_OPTIONS = [AUTO_LOCK_NEVER, 5, 10, 15, 30, 60] as const

const KEY = 'boutiklic_auto_lock_minutes'
const DEFAULT_MINUTES = 5

/** Durée d'inactivité avant verrouillage auto (écran Sécurité > Verrouillage auto — A4) — 5 min par défaut,
 *  `AUTO_LOCK_NEVER` (0) si l'utilisateur a choisi de ne jamais verrouiller. */
export async function getAutoLockMinutes(): Promise<number> {
  const stored = await AsyncStorage.getItem(KEY)
  if (stored === null) return DEFAULT_MINUTES
  const raw = Number(stored)
  return AUTO_LOCK_OPTIONS.includes(raw as (typeof AUTO_LOCK_OPTIONS)[number]) ? raw : DEFAULT_MINUTES
}

export function setAutoLockMinutes(minutes: number) {
  return AsyncStorage.setItem(KEY, String(minutes))
}
