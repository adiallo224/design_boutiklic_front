import { useSyncExternalStore } from 'react'
import {
  getActiveProfile,
  parsePrintSettings,
  removeProfile,
  serializePrintSettings,
  setActiveProfile,
  updateContent,
  upsertProfile,
  type PersistedContentOptions,
  type PrintProfile,
  type PrintSettings,
} from '@boutiklic/shared'
import i18n from '../i18n'

/**
 * Réglages d'impression de CET appareil (profils A4 / thermique, options de contenu) — jamais synchronisés
 * au serveur : une imprimante est liée à un poste (cf. étude étiquettes §3.3). Validation et transformations
 * vivent dans @boutiklic/shared (`printSettings.ts`, réutilisé tel quel par le mobile) ; ce module ne fait
 * que la persistance `localStorage` et l'abonnement React.
 *
 * Toute lecture/écriture de `localStorage` est protégée : fenêtre privée, stockage bloqué ou plein → les
 * réglages restent valables pour la session en cours (cache mémoire), simplement non persistés.
 */
const STORAGE_KEY = 'boutiklic_print_settings'

const newId = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`)

const listeners = new Set<() => void>()
let cache: PrintSettings | null = null

function readFromStorage(): PrintSettings {
  let raw: string | null = null
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    raw = null
  }
  return parsePrintSettings(raw, newId, i18n.t('labels.defaultProfileName'))
}

export function getPrintSettings(): PrintSettings {
  if (!cache) cache = readFromStorage()
  return cache
}

function commit(next: PrintSettings) {
  cache = next
  try {
    localStorage.setItem(STORAGE_KEY, serializePrintSettings(next))
  } catch {
    // stockage indisponible : le cache mémoire garde les réglages pour la session
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  // Modification faite dans un autre onglet/fenêtre de la même origine.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return
    cache = null
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function usePrintSettings(): PrintSettings {
  return useSyncExternalStore(subscribe, getPrintSettings)
}

export function useActivePrintProfile(): PrintProfile {
  return getActiveProfile(usePrintSettings())
}

export const printSettingsActions = {
  /** Ajoute ou remplace un profil ; `false` si la saisie est invalide (rien n'est enregistré). */
  saveProfile(profile: PrintProfile): boolean {
    const next = upsertProfile(getPrintSettings(), profile)
    if (!next) return false
    commit(next)
    return true
  },
  deleteProfile(profileId: string) {
    commit(removeProfile(getPrintSettings(), profileId))
  },
  setActive(profileId: string) {
    commit(setActiveProfile(getPrintSettings(), profileId))
  },
  updateContent(patch: Partial<PersistedContentOptions>) {
    commit(updateContent(getPrintSettings(), patch))
  },
  newProfileId: newId,
}
