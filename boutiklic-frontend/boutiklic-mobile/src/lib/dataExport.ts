import AsyncStorage from '@react-native-async-storage/async-storage'

const KEY = 'boutiklic_last_export_at'

/** Horodatage du dernier export réussi (écran Réglages, F3) — ISO 8601, null si jamais exporté. */
export function getLastExportAt(): Promise<string | null> {
  return AsyncStorage.getItem(KEY)
}

export function recordExportNow() {
  return AsyncStorage.setItem(KEY, new Date().toISOString())
}
