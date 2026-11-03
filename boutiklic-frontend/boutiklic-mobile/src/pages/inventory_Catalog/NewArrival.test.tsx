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
// Modules natifs / lourds que l'arrivage importe mais dont ce test n'a pas besoin.
// costMethod modifiable par test (le préfixe « mock » autorise la référence dans la fabrique) ; absent par défaut = serveur ancien.
let mockCostMethod: string | undefined
let mockTaxEnabled = false
jest.mock('../../hooks/useTenant', () => ({ useTenant: () => ({ tenant: { id: 't1', name: 'Chez Fatou', phone: null, currency: 'GNF', costMethod: mockCostMethod, taxEnabled: mockTaxEnabled } }) }))
jest.mock('../../lib/apiClient', () => {
  class NetworkError extends Error {
    constructor() {
      super('Connexion au serveur impossible')
      this.name = 'NetworkError'
    }
  }
  return { NetworkError, toErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'erreur') }
})
jest.mock('../../lib/authApi', () => ({ toE164Phone: (phone: string) => phone }))
jest.mock('../../lib/syncEngine', () => ({ syncEngine: { enqueue: jest.fn().mockResolvedValue(undefined) } }))
jest.mock('../../lib/suppliersApi', () => ({ suppliersApi: { getAll: jest.fn().mockResolvedValue([]), create: jest.fn() } }))
jest.mock('../../lib/productsApi', () => ({
  productsApi: {
    search: jest.fn().mockResolvedValue([
      { id: 'p1', name: 'Savon de Marseille', barcode: '4006381333931', purchasePrice: 8750, salePrice: 12500, currency: 'GNF' },
      { id: 'p2', name: 'Café moulu', barcode: null, purchasePrice: 350, salePrice: 500, currency: 'GNF' },
      // Acheté en lot : 1 paquet de 3 boîtes payé 1 000 (étude prix décimaux, phase 2).
      { id: 'p3', name: 'Sardines', barcode: null, purchasePrice: 333, salePrice: 400, currency: 'GNF', packSize: 3, packPurchasePrice: 1000 },
      // Coût exact fixé par un arrivage (moyenne pondérée) : 300,5 alors que le prix d'achat affiché, et donc prérempli, est 400.
      { id: 'p4', name: 'Riz', barcode: null, purchasePrice: 400, salePrice: 600, currency: 'GNF', unitCost: 300.5 },
    ]),
  },
}))
jest.mock('../../lib/inventoryApi', () => ({ inventoryApi: { createIntake: jest.fn().mockResolvedValue({}) } }))
// Boutique à un seul dépôt (le cas par défaut) : le sélecteur de dépôt reste caché (cf. NewArrival.tsx, depots.length > 1).
jest.mock('../../lib/depotsApi', () => ({ depotsApi: { getAll: jest.fn().mockResolvedValue([]) } }))
jest.mock('../../components/PhoneNumberField', () => ({ __esModule: true, default: () => null }))
jest.mock('../../components/BarcodeScannerModal', () => ({ __esModule: true, default: () => null }))
jest.mock('./SupplierDetail', () => ({ __esModule: true, default: () => null }))
// Le sélecteur natif ouvre un Modal mesuré à l'écran : remplacé par un composant inerte dont on appelle `onChange` directement.
jest.mock('../../components/SelectField', () => ({ __esModule: true, default: () => null }))

import '../../i18n' // initialise react-i18next (instance simulée ci-dessus)
import React from 'react'
import { TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { NetworkError } from '../../lib/apiClient'
import { inventoryApi } from '../../lib/inventoryApi'
import SelectField from '../../components/SelectField'
import { allText, flush, press } from '../../testing/renderHelpers'
import NewArrival from './NewArrival'

const createIntake = inventoryApi.createIntake as jest.Mock
const mounted: ReactTestRenderer[] = []

async function render(props: Partial<React.ComponentProps<typeof NewArrival>> = {}) {
  const onBack = jest.fn()
  const onCompleted = jest.fn()
  let renderer!: ReactTestRenderer
  await act(async () => {
    renderer = create(<NewArrival onBack={onBack} onCompleted={onCompleted} {...props} />)
  })
  mounted.push(renderer)
  await flush()
  return { renderer, onBack, onCompleted }
}

/** Ajoute une ligne d'arrivage : ouvre « Ligne », choisit l'article, fixe la quantité, valide « Ajouter ». */
async function addLine(renderer: ReactTestRenderer, productId: string, quantity: string) {
  await press(renderer, 'Ligne')
  const picker = renderer.root.findAllByType(SelectField).find((s) => Array.isArray(s.props.options) && s.props.options.some((o: { value: string }) => o.value === productId))
  if (!picker) throw new Error('Sélecteur d’article introuvable')
  await act(async () => {
    picker.props.onChange(productId)
  })
  const qtyInput = renderer.root.findAllByType(TextInput).find((i) => i.props.value === '1')
  if (!qtyInput) throw new Error('Champ quantité introuvable')
  await act(async () => {
    qtyInput.props.onChangeText(quantity)
  })
  await press(renderer, 'Ajouter')
}

beforeEach(() => {
  createIntake.mockReset().mockResolvedValue({})
  mockCostMethod = undefined
  mockTaxEnabled = false
})

afterEach(async () => {
  await act(async () => {
    mounted.splice(0).forEach((renderer) => renderer.unmount())
  })
  await flush()
})

describe('arrivage (mobile) — étiquettes des unités reçues', () => {
  it('sans droit d’impression : comportement d’origine (retour immédiat, aucune proposition)', async () => {
    const { renderer, onBack, onCompleted } = await render()
    await addLine(renderer, 'p1', '24')
    await press(renderer, 'Valider l\'arrivage')
    await flush()
    expect(createIntake).toHaveBeenCalledTimes(1)
    expect(onCompleted).toHaveBeenCalledTimes(1)
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(allText(renderer)).not.toContain('Arrivage enregistré')
  })

  it('avec droit d’impression : propose les étiquettes, quantité = unités reçues, sans quitter l’écran', async () => {
    const onPrintLabels = jest.fn()
    const { renderer, onBack, onCompleted } = await render({ onPrintLabels })
    await addLine(renderer, 'p1', '24')
    await addLine(renderer, 'p2', '6')
    await press(renderer, 'Valider l\'arrivage')
    await flush()

    expect(onCompleted).toHaveBeenCalledTimes(1) // le catalogue est rechargé quoi qu'il arrive
    expect(onBack).not.toHaveBeenCalled()
    const text = allText(renderer)
    expect(text).toContain('Arrivage enregistré')
    expect(text).toContain('2 articles reçus (30 unités)')

    await press(renderer, 'Imprimer les étiquettes')
    expect(onPrintLabels).toHaveBeenCalledWith([
      { productId: 'p1', copies: 24 },
      { productId: 'p2', copies: 6 },
    ])
  })

  it('« Terminer » quitte sans imprimer', async () => {
    const onPrintLabels = jest.fn()
    const { renderer, onBack } = await render({ onPrintLabels })
    await addLine(renderer, 'p1', '3')
    await press(renderer, 'Valider l\'arrivage')
    await flush()
    await press(renderer, 'Terminer')
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(onPrintLabels).not.toHaveBeenCalled()
  })

  it('deux lignes du même article : les quantités sont additionnées', async () => {
    const onPrintLabels = jest.fn()
    const { renderer } = await render({ onPrintLabels })
    await addLine(renderer, 'p1', '10')
    await addLine(renderer, 'p1', '5')
    await press(renderer, 'Valider l\'arrivage')
    await flush()
    await press(renderer, 'Imprimer les étiquettes')
    expect(onPrintLabels).toHaveBeenCalledWith([{ productId: 'p1', copies: 15 }])
  })

  it('arrivage refusé par le serveur : pas de proposition, l’erreur reste affichée', async () => {
    createIntake.mockRejectedValueOnce(new Error('Quantité invalide'))
    const onPrintLabels = jest.fn()
    const { renderer, onCompleted } = await render({ onPrintLabels })
    await addLine(renderer, 'p1', '4')
    await press(renderer, 'Valider l\'arrivage')
    await flush()
    expect(allText(renderer)).toContain('Quantité invalide')
    expect(allText(renderer)).not.toContain('Arrivage enregistré')
    expect(onCompleted).not.toHaveBeenCalled()
  })

  it('hors ligne : l’arrivage est mis en file, et les étiquettes restent proposées', async () => {
    createIntake.mockRejectedValueOnce(new NetworkError())
    const onPrintLabels = jest.fn()
    const { renderer } = await render({ onPrintLabels })
    await addLine(renderer, 'p2', '12')
    await press(renderer, 'Valider l\'arrivage')
    await flush()
    expect(allText(renderer)).toContain('Arrivage enregistré')
    await press(renderer, 'Imprimer les étiquettes')
    expect(onPrintLabels).toHaveBeenCalledWith([{ productId: 'p2', copies: 12 }])
  })
})

/** Étude prix décimaux, phase 2 : achat par lot. Le total d'une ligne est nombre de lots × prix du lot, EXACT : 1 paquet de
 *  3 boîtes à 1 000 fait devoir 1 000 (et non 3 × 333 = 999). Le serveur dérive quantité et coût unitaire du lot. */
describe('arrivage (mobile) — achat par lot', () => {
  async function pick(renderer: ReactTestRenderer, productId: string) {
    await press(renderer, 'Ligne')
    const picker = renderer.root.findAllByType(SelectField).find((s) => Array.isArray(s.props.options) && s.props.options.some((o: { value: string }) => o.value === productId))
    if (!picker) throw new Error('Sélecteur d’article introuvable')
    await act(async () => {
      picker.props.onChange(productId)
    })
  }

  it('un article acheté en lot est prérempli en lot avec le lot de sa fiche', async () => {
    const { renderer } = await render()
    await pick(renderer, 'p3')

    const values = renderer.root.findAllByType(TextInput).map((i) => i.props.value)
    expect(values).toEqual(expect.arrayContaining(['1', '3', '1000'])) // 1 lot, 3 unités par lot, 1 000 le lot
    expect(allText(renderer)).toContain('333,33 GNF') // coût unitaire exact
  })

  it('le total est exact et le lot est envoyé au serveur, qui dérive quantité et coût unitaire', async () => {
    const { renderer } = await render()
    await pick(renderer, 'p3')
    await press(renderer, 'Ajouter')

    expect(allText(renderer)).toContain('1 lot(s) de 3')
    expect(allText(renderer)).toMatch(/1\s000/) // total exact : 1 000, pas 999

    await press(renderer, "Valider l'arrivage")
    await flush()

    const sent = JSON.parse(JSON.stringify(createIntake.mock.calls[0][0]))
    expect(sent.lines).toEqual([
      { productId: 'p3', quantity: 3, unitPurchasePrice: 333, packCount: 1, unitsPerPack: 3, packPrice: 1000 },
    ])
  })

  it('plusieurs lots : quantité en unités = lots × unités par lot', async () => {
    const { renderer } = await render()
    await pick(renderer, 'p3')
    const qtyInput = renderer.root.findAllByType(TextInput).find((i) => i.props.placeholder === 'Nb de lots')
    await act(async () => qtyInput!.props.onChangeText('4'))
    await press(renderer, 'Ajouter')
    await press(renderer, "Valider l'arrivage")
    await flush()

    const sent = JSON.parse(JSON.stringify(createIntake.mock.calls[0][0]))
    expect(sent.lines[0]).toMatchObject({ productId: 'p3', quantity: 12, packCount: 4, unitsPerPack: 3, packPrice: 1000 })
  })

  describe('TVA déductible (payée au fournisseur)', () => {
    const vatField = (renderer: ReactTestRenderer) =>
      renderer.root.findAll((n) => n.props.accessibilityLabel === 'TVA payée au fournisseur (déductible)' && typeof n.props.onChangeText === 'function')[0]

    it("le champ n'apparaît que si la boutique applique la TVA", async () => {
      const { renderer } = await render()
      expect(allText(renderer)).not.toContain('TVA payée au fournisseur')

      mockTaxEnabled = true
      const withTax = await render()
      expect(allText(withTax.renderer)).toContain('TVA payée au fournisseur (déductible)')
    })

    it("la TVA saisie est envoyée avec l'arrivage, sans toucher aux prix d'achat des lignes", async () => {
      mockTaxEnabled = true
      const { renderer } = await render()
      await addLine(renderer, 'p1', '2')

      await act(async () => vatField(renderer).props.onChangeText('3150'))
      await press(renderer, "Valider l'arrivage")
      await flush()

      const sent = JSON.parse(JSON.stringify(createIntake.mock.calls[0][0]))
      expect(sent.deductibleVat).toBe(3150)
      expect(sent.lines[0].unitPurchasePrice).toBe(8750) // le coût d'achat reste tel que saisi
    })

    it("sans TVA saisie, rien n'est envoyé", async () => {
      mockTaxEnabled = true
      const { renderer } = await render()
      await addLine(renderer, 'p1', '1')

      await press(renderer, "Valider l'arrivage")
      await flush()

      expect(JSON.parse(JSON.stringify(createIntake.mock.calls[0][0])).deductibleVat).toBeUndefined()
    })

    it("une TVA supérieure au montant de l'arrivage est signalée et bloque la validation", async () => {
      mockTaxEnabled = true
      const { renderer } = await render()
      await addLine(renderer, 'p1', '1') // 8 750

      await act(async () => vatField(renderer).props.onChangeText('9000'))

      expect(allText(renderer)).toContain("La TVA déductible ne peut pas dépasser le montant de l'arrivage.")
      await press(renderer, "Valider l'arrivage")
      await flush()
      expect(createIntake).not.toHaveBeenCalled()
    })

    it("hors ligne, la TVA part dans l'opération mise en file", async () => {
      mockTaxEnabled = true
      createIntake.mockRejectedValueOnce(new NetworkError())
      const { renderer } = await render()
      await addLine(renderer, 'p1', '2')
      await act(async () => vatField(renderer).props.onChangeText('3150'))

      await press(renderer, "Valider l'arrivage")
      await flush()

      const { syncEngine } = require('../../lib/syncEngine')
      const queued = JSON.parse(syncEngine.enqueue.mock.calls.at(-1)[1])
      expect(queued.deductibleVat).toBe(3150)
    })
  })

  it('un article à l’unité : aucun champ de lot n’est envoyé', async () => {
    const { renderer } = await render()
    await addLine(renderer, 'p1', '24')
    await press(renderer, "Valider l'arrivage")
    await flush()

    const sent = JSON.parse(JSON.stringify(createIntake.mock.calls[0][0]))
    expect(sent.lines).toEqual([{ productId: 'p1', quantity: 24, unitPurchasePrice: 8750 }])
  })
})

describe('arrivage (mobile) — méthode de coût de la boutique', () => {
  const IGNORED = 'Le coût de l\'article ne change pas (méthode manuelle).'

  it('méthode manuelle et coût de la ligne différent de la fiche : prévient que le coût de l\'article ne changera pas', async () => {
    mockCostMethod = 'MANUAL'
    const { renderer } = await render()
    await addLine(renderer, 'p4', '10')

    const text = allText(renderer)
    expect(text).toContain('Coût de la fiche : 300,5')
    expect(text).toContain('cet arrivage : 400')
    expect(text).toContain(IGNORED)
  })

  it('méthode manuelle et même coût que la fiche : aucun avertissement', async () => {
    mockCostMethod = 'MANUAL'
    const { renderer } = await render()
    await addLine(renderer, 'p2', '10')

    expect(allText(renderer)).not.toContain(IGNORED)
  })

  it('un article acheté en lot, au prix du lot de sa fiche : aucun avertissement (coût exact identique)', async () => {
    mockCostMethod = 'MANUAL'
    const { renderer } = await render()
    await addLine(renderer, 'p3', '1')

    expect(allText(renderer)).not.toContain(IGNORED)
  })

  it('moyenne pondérée : pas d\'avertissement, mais une note annonce le recalcul à l\'enregistrement', async () => {
    mockCostMethod = 'WEIGHTED_AVERAGE'
    const { renderer } = await render()
    await addLine(renderer, 'p4', '10')

    const text = allText(renderer)
    expect(text).not.toContain(IGNORED)
    expect(text).toContain('recalculé en moyenne pondérée avec son stock actuel')
  })

  it('dernier prix : la note annonce que le coût deviendra celui de l\'arrivage', async () => {
    mockCostMethod = 'LAST_PRICE'
    const { renderer } = await render()
    await addLine(renderer, 'p4', '10')

    expect(allText(renderer)).toContain('deviendra celui de cet arrivage')
  })

  it('sans ligne, aucune note : rien à annoncer', async () => {
    mockCostMethod = 'WEIGHTED_AVERAGE'
    const { renderer } = await render()

    expect(allText(renderer)).not.toContain('moyenne pondérée')
  })

  it('méthode inconnue d\'un serveur ancien : ni avertissement ni note, comportement d\'origine', async () => {
    mockCostMethod = undefined
    const { renderer } = await render()
    await addLine(renderer, 'p4', '10')

    const text = allText(renderer)
    expect(text).not.toContain(IGNORED)
    expect(text).not.toContain('à l\'enregistrement')
  })
})
