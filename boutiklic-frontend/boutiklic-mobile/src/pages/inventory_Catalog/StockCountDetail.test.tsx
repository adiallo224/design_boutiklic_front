// react-test-renderer et react-native résolvent React à la RACINE du monorepo, alors que le code de l'app pourrait
// résoudre la copie du dossier mobile : deux copies de React → « Invalid hook call ». On les aligne sur celle du renderer.
jest.mock('react', () => jest.requireActual(require.resolve('react', { paths: [require('path').dirname(require.resolve('react-test-renderer'))] })))
// Le babel de l'app compile le JSX vers le runtime NativeWind, introuvable depuis les fichiers react-native de la racine.
jest.mock('react-native-css-interop/jsx-runtime', () => jest.requireActual('react/jsx-runtime'), { virtual: true })
jest.mock('react-native-css-interop/jsx-dev-runtime', () => jest.requireActual('react/jsx-dev-runtime'), { virtual: true })
// lucide-react-native est publié en ESM (non transformé par jest) : les icônes ne sont pas l'objet de ce test.
jest.mock('lucide-react-native', () => new Proxy({ __esModule: true }, { get: (target: Record<string, unknown>, prop: string) => (prop in target ? target[prop] : () => null) }))
// i18n réel (textes fr de l'app) mais sans expo-localization, dont le module natif n'est pas chargeable sous jest ici.
jest.mock('../../i18n', () => {
  const { createInstance } = require('i18next')
  const { initReactI18next } = require('react-i18next')
  const i18n = createInstance()
  i18n.use(initReactI18next).init({ lng: 'fr', fallbackLng: 'fr', resources: { fr: { translation: require('../../i18n/locales/fr.json') } }, interpolation: { escapeValue: false } })
  return { __esModule: true, default: i18n }
})
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))
// Rôle modifiable par test (le préfixe « mock » autorise la référence dans la fabrique).
let mockRole = 'OWNER'
jest.mock('../../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', role: mockRole, tenantId: 't1' } }) }))
jest.mock('../../lib/apiClient', () => {
  class NetworkError extends Error {
    constructor() {
      super('Connexion au serveur impossible')
      this.name = 'NetworkError'
    }
  }
  return { NetworkError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
jest.mock('../../lib/session', () => ({ getAccessToken: jest.fn().mockResolvedValue('token'), getActiveTenantId: jest.fn().mockResolvedValue('t1') }))
jest.mock('../../lib/productsApi', () => ({
  productsApi: {
    search: jest.fn().mockResolvedValue([
      { id: 'rice', name: 'Riz local 50kg', barcode: '6120000000011' },
      { id: 'oil', name: 'Huile de palme 5L', barcode: '6120000000028' },
      { id: 'soap', name: 'Savon de Marseille', barcode: null },
    ]),
  },
}))
jest.mock('../../lib/stockCountsApi', () => ({
  stockCountsApi: {
    get: jest.fn(),
    recordCounts: jest.fn(),
    clearCount: jest.fn(),
    submit: jest.fn(),
    reopen: jest.fn(),
    validate: jest.fn(),
    cancel: jest.fn(),
    sheetPath: (id: string, format: string) => `/stock-counts/${id}/sheet?format=${format}`,
  },
}))
// La file d'opérations (outbox) est simulée : on vérifie ce qui y est mis et on joue le rôle de son envoi.
jest.mock('../../lib/syncEngine', () => ({
  syncEngine: {
    enqueue: jest.fn().mockResolvedValue({}),
    getOutbox: jest.fn().mockResolvedValue([]),
    processOutbox: jest.fn().mockResolvedValue({ synced: 0, failed: 0 }),
    subscribeOutboxChanges: jest.fn(() => () => true),
  },
}))
jest.mock('expo-file-system', () => ({
  File: class {
    uri = 'file:///cache/feuille.pdf'
    static downloadFileAsync = jest.fn().mockResolvedValue({ uri: 'file:///cache/feuille.pdf' })
  },
  Paths: { cache: 'cache' },
}))
jest.mock('expo-sharing', () => ({ isAvailableAsync: jest.fn().mockResolvedValue(true), shareAsync: jest.fn().mockResolvedValue(undefined) }))
// Le scanner caméra est remplacé par un composant inerte dont on appelle `onDetected` directement.
let mockScannerProps: { open: boolean; onDetected: (code: string) => void; onClose: () => void } | null = null
jest.mock('../../components/BarcodeScannerModal', () => ({
  __esModule: true,
  default: (props: { open: boolean; onDetected: (code: string) => void; onClose: () => void }) => {
    mockScannerProps = props
    return null
  },
}))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { Alert, TextInput } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { NetworkError } from '../../lib/apiClient'
import { stockCountsApi, type StockCountResponse } from '../../lib/stockCountsApi'
import { loadPendingCounts, removePendingIfSame, setPendingCount } from '../../lib/stockCountDraft'
import { syncEngine } from '../../lib/syncEngine'
import { allText, flush, press } from '../../testing/renderHelpers'
import StockCountDetail from './StockCountDetail'

const api = stockCountsApi as unknown as Record<'get' | 'recordCounts' | 'clearCount' | 'submit' | 'reopen' | 'validate' | 'cancel', jest.Mock>
const engine = syncEngine as unknown as Record<'enqueue' | 'getOutbox' | 'processOutbox' | 'subscribeOutboxChanges', jest.Mock>
const mounted: ReactTestRenderer[] = []

/** Une opération de saisie en file, telle que le mobile la met en file hors ligne. */
function queuedEntry(productId: string, quantity: number | null) {
  return {
    operationId: `op-${productId}`, type: 'RECORD_STOCK_COUNT_LINES', createdAt: '2026-10-24T09:30:00.000Z', status: 'PENDING',
    payload: JSON.stringify({ countId: 'c1', lines: [{ productId, quantity, countedAt: '2026-10-24T09:30:00.000Z' }] }),
  }
}

function countWith(counted: Record<string, number | null>, overrides: Partial<StockCountResponse> = {}, hideSystem = false): StockCountResponse {
  const systemQty: Record<string, number> = { rice: 10, oil: 4, soap: 6 }
  const lines = ['rice', 'oil', 'soap'].map((productId) => ({
    productId,
    systemQty: hideSystem ? null : systemQty[productId],
    countedQty: counted[productId] ?? null,
    countedAt: counted[productId] == null ? null : '2026-10-24T10:00:00Z',
    countedBy: counted[productId] == null ? null : 'u1',
    appliedDelta: null,
  }))
  return {
    id: 'c1', depotId: 'd1', categoryId: null, blind: true, status: 'COUNTING', snapshotAt: '2026-10-24T09:00:00Z', createdBy: 'u1', validatedBy: null,
    note: null, createdAt: '2026-10-24T09:00:00Z', validatedAt: null, lineCount: 3, countedCount: Object.values(counted).filter((v) => v != null).length, lines, ...overrides,
  }
}

async function render() {
  const onBack = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<StockCountDetail countId="c1" onBack={onBack} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onBack }
}

async function typeQuantity(renderer: ReactTestRenderer, text: string) {
  const input = renderer.root.findAllByType(TextInput).find((i) => i.props.keyboardType === 'number-pad')
  if (!input) throw new Error('champ de quantité introuvable')
  await act(async () => {
    input.props.onChangeText(text)
  })
}

beforeEach(async () => {
  mockRole = 'OWNER'
  mockScannerProps = null
  await AsyncStorage.clear()
  Object.values(api).forEach((fn) => fn.mockReset?.())
  engine.enqueue.mockReset().mockResolvedValue({})
  engine.getOutbox.mockReset().mockResolvedValue([])
  engine.processOutbox.mockReset().mockResolvedValue({ synced: 0, failed: 0 })
  api.get.mockResolvedValue(countWith({ oil: 4 }))
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined)
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
  jest.restoreAllMocks()
})

describe('inventaire physique (mobile) — saisie', () => {
  it('affiche les articles, le stock système et la progression', async () => {
    const { renderer } = await render()

    const text = allText(renderer)
    expect(text).toContain('1 / 3 articles comptés')
    expect(text).toContain('Riz local 50kg')
    expect(text).toContain('Huile de palme 5L')
    expect(text).toContain('Système : 10')
    expect(text).toContain('Compté : 4')
    expect(text).toContain('Non compté')
  })

  it('un comptage aveugle ne montre pas le stock système à un compteur', async () => {
    api.get.mockResolvedValue(countWith({}, {}, true))
    const { renderer } = await render()

    expect(allText(renderer)).not.toContain('Système :')
    expect(allText(renderer)).not.toContain('Écarts')
  })

  it('une quantité saisie sur un article est envoyée au serveur', async () => {
    api.recordCounts.mockResolvedValue(countWith({ rice: 7, oil: 4 }))
    const { renderer } = await render()

    await press(renderer, 'Riz local 50kg')
    await typeQuantity(renderer, '7')
    await press(renderer, 'Enregistrer')
    await flush()

    expect(api.recordCounts).toHaveBeenCalledWith('c1', [{ productId: 'rice', quantity: 7 }])
    expect(allText(renderer)).toContain('2 / 3 articles comptés')
  })

  it('une quantité invalide est refusée avant tout envoi', async () => {
    const { renderer } = await render()

    await press(renderer, 'Riz local 50kg')
    await typeQuantity(renderer, 'abc')
    await press(renderer, 'Enregistrer')

    expect(allText(renderer)).toContain('Quantité invalide')
    expect(api.recordCounts).not.toHaveBeenCalled()
  })

  it('une saisie vide sur un article déjà compté retire son comptage', async () => {
    api.clearCount.mockResolvedValue(countWith({}))
    const { renderer } = await render()

    await press(renderer, 'Huile de palme 5L')
    await typeQuantity(renderer, '')
    await press(renderer, 'Enregistrer')
    await flush()

    expect(api.clearCount).toHaveBeenCalledWith('c1', 'oil')
    expect(allText(renderer)).toContain('0 / 3 articles comptés')
  })
})

describe('inventaire physique (mobile) — scan', () => {
  it('scanner un code-barres ouvre la saisie de l\'article, puis la caméra se rouvre (scan continu)', async () => {
    api.recordCounts.mockResolvedValue(countWith({ rice: 10, oil: 4 }))
    const { renderer } = await render()

    await act(async () => {
      mockScannerProps?.onDetected('6120000000011')
    })
    expect(allText(renderer)).toContain('Quantité comptée')
    expect(allText(renderer)).toContain('Riz local 50kg')

    await typeQuantity(renderer, '10')
    await press(renderer, 'Enregistrer')
    await flush()

    expect(api.recordCounts).toHaveBeenCalledWith('c1', [{ productId: 'rice', quantity: 10 }])
    expect(mockScannerProps?.open).toBe(true)
  })

  it('un code-barres hors du comptage le signale sans rien enregistrer', async () => {
    const { renderer } = await render()

    await act(async () => {
      mockScannerProps?.onDetected('0000000000000')
    })

    expect(allText(renderer)).toContain('Aucun article ne correspond à « 0000000000000 »')
    expect(api.recordCounts).not.toHaveBeenCalled()
  })
})

describe('inventaire physique (mobile) — brouillon local', () => {
  it('sans réseau, la quantité est mise en file avec l\'heure de l\'appareil, gardée sur l\'appareil et marquée « À envoyer »', async () => {
    api.recordCounts.mockRejectedValue(new NetworkError())
    const before = Date.now()
    const { renderer } = await render()

    await press(renderer, 'Riz local 50kg')
    await typeQuantity(renderer, '7')
    await press(renderer, 'Enregistrer')
    await flush()

    expect(engine.enqueue).toHaveBeenCalledTimes(1)
    const [type, payload] = engine.enqueue.mock.calls[0]
    expect(type).toBe('RECORD_STOCK_COUNT_LINES')
    const parsed = JSON.parse(payload)
    expect(parsed.countId).toBe('c1')
    expect(parsed.lines).toHaveLength(1)
    expect(parsed.lines[0]).toMatchObject({ productId: 'rice', quantity: 7 })
    expect(new Date(parsed.lines[0].countedAt).getTime()).toBeGreaterThanOrEqual(before)       // l'heure de la saisie, pas de l'envoi
    expect(await loadPendingCounts('c1')).toEqual({ rice: 7 })
    const text = allText(renderer)
    expect(text).toContain('À envoyer')
    expect(text).toContain('Compté : 7')
    expect(text).toContain('1 saisie(s) enregistrée(s) sur l\'appareil')
  })

  it('« Envoyer maintenant » fait partir la file : la saisie synchronisée sort du brouillon et le comptage se met à jour', async () => {
    await setPendingCount('c1', 'rice', 7)
    engine.getOutbox.mockResolvedValue([queuedEntry('rice', 7)])
    const { renderer } = await render()
    expect(allText(renderer)).toContain('Envoyer maintenant')
    expect(api.recordCounts).not.toHaveBeenCalled()                        // la file s'en charge : pas d'envoi direct en double

    // Le réseau est revenu : la file envoie l'opération, et le crochet de fin de synchro vide le brouillon (cf. lib/stockCountSyncHooks).
    engine.processOutbox.mockImplementation(async () => {
      await removePendingIfSame('c1', [{ productId: 'rice', quantity: 7 }])
      engine.getOutbox.mockResolvedValue([])
      api.get.mockResolvedValue(countWith({ rice: 7, oil: 4 }))
      return { synced: 1, failed: 0 }
    })
    await press(renderer, 'Envoyer maintenant')
    await flush()

    expect(engine.processOutbox).toHaveBeenCalled()
    expect(await loadPendingCounts('c1')).toEqual({})
    expect(allText(renderer)).not.toContain('Envoyer maintenant')
    expect(allText(renderer)).toContain('2 / 3 articles comptés')
    expect(api.recordCounts).not.toHaveBeenCalled()
  })

  it('hors ligne, « Envoyer maintenant » le dit et garde les saisies', async () => {
    await setPendingCount('c1', 'rice', 7)
    engine.getOutbox.mockResolvedValue([queuedEntry('rice', 7)])
    const { renderer } = await render()

    await press(renderer, 'Envoyer maintenant')
    await flush()

    expect(allText(renderer)).toContain('Envoi impossible : pas de connexion')
    expect(await loadPendingCounts('c1')).toEqual({ rice: 7 })
  })

  it('à la réouverture de l\'écran, une saisie du brouillon SANS opération en file (orpheline) est renvoyée directement', async () => {
    await setPendingCount('c1', 'rice', 7)
    await setPendingCount('c1', 'soap', null)
    api.recordCounts.mockResolvedValue(countWith({ rice: 7, oil: 4 }))
    api.clearCount.mockResolvedValue(countWith({ rice: 7, oil: 4 }))

    await render()

    expect(api.recordCounts).toHaveBeenCalledWith('c1', [{ productId: 'rice', quantity: 7 }])
    expect(api.clearCount).toHaveBeenCalledWith('c1', 'soap')
    expect(await loadPendingCounts('c1')).toEqual({})
  })

  it('terminer le comptage est refusé tant que des saisies n\'ont pas pu être envoyées', async () => {
    await setPendingCount('c1', 'rice', 7)
    engine.getOutbox.mockResolvedValue([queuedEntry('rice', 7)])           // la file n'a pas pu partir (pas de réseau)
    const { renderer } = await render()

    await press(renderer, 'Terminer le comptage')
    await flush()

    expect(engine.processOutbox).toHaveBeenCalled()                        // on a essayé de vider la file avant de refuser
    expect(api.submit).not.toHaveBeenCalled()
    expect(allText(renderer)).toContain('Envoyez d\'abord les saisies en attente')
  })

  it('terminer le comptage envoie d\'abord la file, puis soumet', async () => {
    await setPendingCount('c1', 'rice', 7)
    engine.getOutbox.mockResolvedValue([queuedEntry('rice', 7)])
    api.submit.mockResolvedValue(countWith({ rice: 7, oil: 4 }, { status: 'PENDING_REVIEW' }))
    const { renderer } = await render()

    engine.processOutbox.mockImplementation(async () => {
      await removePendingIfSame('c1', [{ productId: 'rice', quantity: 7 }])
      engine.getOutbox.mockResolvedValue([])
      return { synced: 1, failed: 0 }
    })
    await press(renderer, 'Terminer le comptage')
    await flush()

    expect(api.submit).toHaveBeenCalledWith('c1')
    expect(allText(renderer)).toContain('En revue')
  })

  it('un brouillon dont le comptage n\'est plus en saisie est abandonné (son opération en file reste visible comme échec)', async () => {
    await setPendingCount('c1', 'rice', 7)
    engine.getOutbox.mockResolvedValue([queuedEntry('rice', 7)])
    api.get.mockResolvedValue(countWith({ oil: 4 }, { status: 'PENDING_REVIEW' }))

    const { renderer } = await render()

    expect(await loadPendingCounts('c1')).toEqual({})
    expect(allText(renderer)).not.toContain('Envoyer maintenant')
    expect(api.recordCounts).not.toHaveBeenCalled()
  })
})

describe('inventaire physique (mobile) — fin de comptage et rôles', () => {
  it('terminer le comptage soumet le comptage', async () => {
    api.submit.mockResolvedValue(countWith({ oil: 4 }, { status: 'PENDING_REVIEW' }))
    const { renderer } = await render()

    await press(renderer, 'Terminer le comptage')
    await flush()

    expect(api.submit).toHaveBeenCalledWith('c1')
    expect(allText(renderer)).toContain('En revue')
  })

  it('en revue, le propriétaire valide après confirmation', async () => {
    api.get.mockResolvedValue(countWith({ rice: 7, oil: 4 }, { status: 'PENDING_REVIEW' }))
    api.validate.mockResolvedValue(countWith({ rice: 7, oil: 4 }, { status: 'VALIDATED' }))
    const { renderer } = await render()

    expect(allText(renderer)).toContain('Articles en écart')
    expect(allText(renderer)).toContain('Annuler le comptage')            // le propriétaire a bien ce bouton (le vendeur, non)
    await press(renderer, 'Valider le comptage')
    expect(api.validate).not.toHaveBeenCalled()                            // rien avant la confirmation

    const alert = Alert.alert as jest.Mock
    expect(alert).toHaveBeenCalledTimes(1)
    expect(alert.mock.calls[0][1]).toContain('1 article(s) en écart')
    const confirm = (alert.mock.calls[0][2] as { text: string; onPress?: () => void }[]).find((b) => b.text === 'Valider')
    await act(async () => {
      confirm?.onPress?.()
    })
    await flush()

    expect(api.validate).toHaveBeenCalledWith('c1')
    expect(allText(renderer)).toContain('Comptage validé')
  })

  it('un vendeur en revue n\'a ni validation ni annulation', async () => {
    mockRole = 'SELLER'
    api.get.mockResolvedValue(countWith({ rice: 7 }, { status: 'PENDING_REVIEW' }))
    const { renderer } = await render()

    const text = allText(renderer)
    expect(text).toContain('attend la validation du propriétaire')
    expect(text).not.toContain('Valider le comptage')
    expect(text).not.toContain('Annuler le comptage')
  })

  it('un vendeur peut compter et terminer, sans pouvoir annuler', async () => {
    mockRole = 'SELLER'
    const { renderer } = await render()

    expect(allText(renderer)).toContain('Terminer le comptage')
    expect(allText(renderer)).not.toContain('Annuler le comptage')
  })

  it('un comptage validé n\'est plus modifiable : toucher une ligne n\'ouvre rien', async () => {
    api.get.mockResolvedValue(countWith({ rice: 7, oil: 4 }, { status: 'VALIDATED' }))
    const { renderer } = await render()

    await press(renderer, 'Riz local 50kg')

    expect(allText(renderer)).not.toContain('Quantité comptée')
    expect(allText(renderer)).toContain('Comptage validé')
  })
})
