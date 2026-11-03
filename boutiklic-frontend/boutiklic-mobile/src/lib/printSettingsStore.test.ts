import AsyncStorage from '@react-native-async-storage/async-storage'
import { createPrintProfile, serializePrintSettings, defaultPrintSettings, getActiveProfile, type PrintSettings } from '@boutiklic/shared'
import {
  __resetPrintSettingsStoreForTests,
  getPrintSettings,
  hydratePrintSettings,
  printSettingsActions,
} from './printSettingsStore'

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
jest.mock('../i18n', () => ({ __esModule: true, default: { t: (key: string) => (key === 'labels.defaultProfileName' ? 'A4' : key) } }))
let mockUuid = 0
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockUuid}` }))

const KEY = 'boutiklic_print_settings'
const stored = (settings: PrintSettings) => AsyncStorage.setItem(KEY, serializePrintSettings(settings))
const roll = (id: string) => createPrintProfile({ id, name: `Rouleau ${id}`, kind: 'THERMAL_ROLL' })
const flush = () => new Promise<void>((resolve) => setImmediate(resolve))

beforeEach(async () => {
  await AsyncStorage.clear()
  __resetPrintSettingsStoreForTests()
  mockUuid = 0
})

describe('réglages par défaut', () => {
  it('avant toute lecture : un profil « A4 » actif (l’app est utilisable sans configuration)', () => {
    const settings = getPrintSettings()
    expect(settings.profiles).toHaveLength(1)
    expect(getActiveProfile(settings)).toMatchObject({ name: 'A4', kind: 'SHEET_A4', presetId: 'small-24' })
  })

  it('renvoie la même référence tant que rien ne change (requis par useSyncExternalStore)', () => {
    expect(getPrintSettings()).toBe(getPrintSettings())
  })
})

describe('hydratePrintSettings', () => {
  it('charge les réglages enregistrés', async () => {
    await stored({ ...defaultPrintSettings(() => 'a'), profiles: [roll('r1'), roll('r2')], activeProfileId: 'r2' })
    await hydratePrintSettings()
    const settings = getPrintSettings()
    expect(settings.profiles.map((p) => p.id)).toEqual(['r1', 'r2'])
    expect(settings.activeProfileId).toBe('r2')
  })

  it('rien d’enregistré : garde les réglages par défaut', async () => {
    const before = getPrintSettings()
    await hydratePrintSettings()
    expect(getPrintSettings()).toBe(before)
  })

  it('JSON corrompu : réglages par défaut, sans lever', async () => {
    await AsyncStorage.setItem(KEY, '{pas du json')
    await expect(hydratePrintSettings()).resolves.toBeUndefined()
    expect(getPrintSettings().profiles).toHaveLength(1)
  })

  it('ne lit AsyncStorage qu’une fois', async () => {
    const getItem = AsyncStorage.getItem as jest.Mock
    getItem.mockClear()
    await hydratePrintSettings()
    await hydratePrintSettings()
    expect(getItem).toHaveBeenCalledTimes(1)
  })

  it('une erreur de lecture est avalée : les réglages par défaut restent utilisables', async () => {
    ;(AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(new Error('disque plein'))
    await expect(hydratePrintSettings()).resolves.toBeUndefined()
    expect(getPrintSettings().profiles).toHaveLength(1)
  })

  it('CHOIX DE L’UTILISATEUR PRIORITAIRE : une modification faite avant la fin de la lecture n’est pas écrasée', async () => {
    await stored({ ...defaultPrintSettings(() => 'a'), profiles: [roll('vieux')], activeProfileId: 'vieux' })
    const hydration = hydratePrintSettings() // lecture lancée mais pas encore terminée
    printSettingsActions.updateContent({ showCutMarks: true }) // l'utilisateur agit tout de suite
    await hydration
    const settings = getPrintSettings()
    expect(settings.content.showCutMarks).toBe(true)
    expect(settings.profiles.map((p) => p.id)).not.toContain('vieux') // la lecture tardive n'a rien remplacé
  })
})

describe('actions', () => {
  it('saveProfile persiste dans AsyncStorage et est relu tel quel', async () => {
    expect(printSettingsActions.saveProfile(roll('r1'))).toBe(true)
    await flush()
    __resetPrintSettingsStoreForTests()
    await hydratePrintSettings()
    expect(getPrintSettings().profiles.map((p) => p.id)).toContain('r1')
  })

  it('saveProfile refuse un profil invalide : rien n’est enregistré', async () => {
    const before = getPrintSettings()
    expect(printSettingsActions.saveProfile({ ...roll('bad'), name: '' })).toBe(false)
    expect(getPrintSettings()).toBe(before)
    expect(await AsyncStorage.getItem(KEY)).toBeNull()
  })

  it('setActive / deleteProfile : le dernier profil n’est jamais supprimé', () => {
    printSettingsActions.saveProfile(roll('r1'))
    const ids = getPrintSettings().profiles.map((p) => p.id)
    for (const id of ids) printSettingsActions.deleteProfile(id)
    expect(getPrintSettings().profiles).toHaveLength(1)
  })

  it('setActive change le profil actif ; un id inconnu est ignoré', () => {
    printSettingsActions.saveProfile(roll('r1'))
    printSettingsActions.setActive('r1')
    expect(getPrintSettings().activeProfileId).toBe('r1')
    printSettingsActions.setActive('inconnu')
    expect(getPrintSettings().activeProfileId).toBe('r1')
  })

  it('updateContent fusionne les options et persiste', async () => {
    printSettingsActions.updateContent({ showShopName: true })
    await flush()
    expect(JSON.parse((await AsyncStorage.getItem(KEY)) as string).content.showShopName).toBe(true)
  })

  it('une erreur d’écriture est avalée : les réglages restent valables pour la session', () => {
    ;(AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('stockage plein'))
    expect(() => printSettingsActions.updateContent({ showCutMarks: true })).not.toThrow()
    expect(getPrintSettings().content.showCutMarks).toBe(true)
  })

  it('newProfileId fournit des identifiants distincts', () => {
    expect(printSettingsActions.newProfileId()).not.toBe(printSettingsActions.newProfileId())
  })
})
