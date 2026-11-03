import { useEffect, useSyncExternalStore } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Crypto from 'expo-crypto'
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
 * Réglages d'impression de CET appareil (profils A4 / thermique, options de contenu) — jamais synchronisés au
 * serveur : une imprimante est liée à un appareil (cf. étude étiquettes §3.3). Validation et transformations
 * vivent dans @boutiklic/shared (`printSettings.ts`, le même code que le web) ; ce module ne fait que la
 * persistance AsyncStorage et l'abonnement React.
 *
 * AsyncStorage est asynchrone : l'app démarre avec les réglages par défaut (un profil « A4 »), puis `hydrate()`
 * les remplace par ceux enregistrés. Une modification faite AVANT la fin de la lecture l'emporte (`touched`) :
 * on n'écrase jamais un choix de l'utilisateur par une lecture arrivée en retard. Toute erreur de stockage est
 * avalée — les réglages restent valables pour la session (cache mémoire), simplement non persistés.
 */
const STORAGE_KEY = 'boutiklic_print_settings'

const newId = () => Crypto.randomUUID()
const defaultName = () => i18n.t('labels.defaultProfileName')

const listeners = new Set<() => void>()
let cache: PrintSettings | null = null
let hydration: Promise<void> | null = null
let touched = false

const notify = () => listeners.forEach((listener) => listener())

export function getPrintSettings(): PrintSettings {
  if (!cache) cache = parsePrintSettings(null, newId, defaultName())
  return cache
}

/** Lit AsyncStorage une seule fois ; sans effet si l'utilisateur a déjà modifié les réglages entre-temps. */
export function hydratePrintSettings(): Promise<void> {
  if (!hydration) {
    hydration = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (touched || raw === null) return
        cache = parsePrintSettings(raw, newId, defaultName())
        notify()
      })
      .catch(() => undefined)
  }
  return hydration
}

function commit(next: PrintSettings) {
  touched = true
  cache = next
  AsyncStorage.setItem(STORAGE_KEY, serializePrintSettings(next)).catch(() => undefined)
  notify()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePrintSettings(): PrintSettings {
  useEffect(() => {
    hydratePrintSettings()
  }, [])
  return useSyncExternalStore(subscribe, getPrintSettings, getPrintSettings)
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

/** Réservé aux tests : remet le module dans son état initial. */
export function __resetPrintSettingsStoreForTests() {
  cache = null
  hydration = null
  touched = false
  listeners.clear()
}
