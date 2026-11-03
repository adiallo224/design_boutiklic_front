import { describe, expect, it } from 'vitest'
import {
  COST_METHODS,
  CURRENCY_DECIMALS,
  UNIT_COST_SCALE,
  currencyDecimals,
  effectiveUnitCost,
  formatMoney,
  formatSellingPrice,
  formatUnitCost,
  intakeCostIgnored,
  intakeLineTotal,
  intakeLineUnitCost,
  isCostMethod,
  parseMoneyInput,
  roundHalfUp,
  sanitizeMoneyInput,
  unitCostFromPack,
  unitPriceLineTotal,
} from '@boutiklic/shared/src/pricing'

/** Miroir client de UnitCost / Product.unitCost() côté serveur (étude prix décimaux, phases 1-2). */
describe('unitCostFromPack', () => {
  it('paquet de sardines : 1 000 pour 3 boîtes = 333,333333 (jamais tronqué à 333)', () => {
    expect(unitCostFromPack(1000, 3)).toBe(333.333333)
  })

  it('division exacte : 3 600 pour 12 = 300', () => {
    expect(unitCostFromPack(3600, 12)).toBe(300)
  })

  it('garde 6 décimales, arrondi commercial', () => {
    expect(UNIT_COST_SCALE).toBe(6)
    expect(unitCostFromPack(2, 3)).toBe(0.666667)
  })

  it('lot invalide : 0, jamais Infinity ni NaN', () => {
    expect(unitCostFromPack(1000, 0)).toBe(0)
    expect(unitCostFromPack(1000, -2)).toBe(0)
    expect(unitCostFromPack(-5, 3)).toBe(0)
    expect(unitCostFromPack(Number.NaN, 3)).toBe(0)
  })

  it('lot gratuit : coût 0', () => {
    expect(unitCostFromPack(0, 3)).toBe(0)
  })
})

describe('roundHalfUp', () => {
  it('0 décimale, comme Money en GNF/FCFA', () => {
    expect(roundHalfUp(333.333333)).toBe(333)
    expect(roundHalfUp(333.5)).toBe(334)
    expect(roundHalfUp(333.49)).toBe(333)
    expect(roundHalfUp(0.5)).toBe(1)
  })

  it('n décimales', () => {
    expect(roundHalfUp(1.005, 2)).toBe(1.01)
    expect(roundHalfUp(2.345, 2)).toBe(2.35)
  })
})

describe('effectiveUnitCost', () => {
  it('avec un lot : le coût exact, pas le prix d\'achat arrondi', () => {
    expect(effectiveUnitCost({ purchasePrice: 333, packSize: 3, packPurchasePrice: 1000 })).toBe(333.333333)
  })

  it('sans lot : le prix d\'achat', () => {
    expect(effectiveUnitCost({ purchasePrice: 350 })).toBe(350)
    expect(effectiveUnitCost({ purchasePrice: 350, packSize: null, packPurchasePrice: null })).toBe(350)
  })

  it('un lot incomplet est ignoré (le serveur refuse de toute façon un lot à moitié rempli)', () => {
    expect(effectiveUnitCost({ purchasePrice: 350, packSize: 3, packPurchasePrice: null })).toBe(350)
  })

  // Phase 7e : une méthode de coût (dernier prix, moyenne pondérée) fixe un coût exact que ni le lot ni le prix d'achat arrondi ne
  // permettent de retrouver ; le serveur le renvoie et il doit l'emporter.
  it('le coût exact stocké par le serveur est prioritaire sur le prix d\'achat arrondi', () => {
    expect(effectiveUnitCost({ purchasePrice: 333, unitCost: 333.333333 })).toBe(333.333333)
  })

  it('le coût exact stocké est prioritaire sur le lot de la fiche (le lot n\'est qu\'une référence de saisie)', () => {
    expect(effectiveUnitCost({ purchasePrice: 340, packSize: 3, packPurchasePrice: 1000, unitCost: 340 })).toBe(340)
  })

  it('un coût stocké à 0 est un vrai coût (article gratuit), pas une absence', () => {
    expect(effectiveUnitCost({ purchasePrice: 0, unitCost: 0 })).toBe(0)
  })

  it('un coût stocké absent ou illisible retombe sur le lot, puis le prix d\'achat', () => {
    expect(effectiveUnitCost({ purchasePrice: 333, packSize: 3, packPurchasePrice: 1000, unitCost: null })).toBe(333.333333)
    expect(effectiveUnitCost({ purchasePrice: 350, unitCost: undefined })).toBe(350)
    expect(effectiveUnitCost({ purchasePrice: 350, unitCost: Number.NaN })).toBe(350)
  })
})

describe('intakeLineTotal', () => {
  it('à l\'unité : quantité × prix unitaire', () => {
    expect(intakeLineTotal({ quantity: 10, unitPurchasePrice: 5000 })).toBe(50000)
  })

  it('par lot : nombre de lots × prix du lot, exact — 1 paquet de 3 boîtes à 1 000 = 1 000, pas 999', () => {
    const line = { quantity: 3, unitPurchasePrice: 333, packCount: 1, packPrice: 1000 }
    expect(intakeLineTotal(line)).toBe(1000)
    expect(line.quantity * line.unitPurchasePrice).toBe(999) // ce que donnerait l'ancien calcul
  })

  it('plusieurs lots : 4 cartons de 12 à 3 600 = 14 400', () => {
    expect(intakeLineTotal({ quantity: 48, unitPurchasePrice: 300, packCount: 4, packPrice: 3600 })).toBe(14400)
  })
})

describe('formatUnitCost', () => {
  it('jusqu\'à 2 décimales pour un coût non entier', () => {
    expect(formatUnitCost(333.333333, 'fr')).toMatch(/^333,33$/)
    expect(formatUnitCost(333.333333, 'en')).toBe('333.33')
  })

  it('pas de décimales inutiles pour un coût entier', () => {
    expect(formatUnitCost(350, 'en')).toBe('350')
  })
})

// ---- Phase 5 : précision de la devise, affichage et saisie des montants --------------------------------------------

describe('currencyDecimals', () => {
  it('devises sans centime : 0 décimale (miroir de Currency.java)', () => {
    for (const currency of ['GNF', 'FCFA', 'BIF', 'KMF', 'CDF', 'DJF', 'MGA', 'MWK', 'UGX', 'RWF', 'SOS', 'SDG', 'SSP', 'TZS']) expect(currencyDecimals(currency)).toBe(0)
  })

  it('devises à centimes : 2 décimales (miroir de Currency.java)', () => {
    for (const currency of ['SLE', 'LRD', 'GHS', 'NGN', 'GMD', 'CVE', 'DZD', 'AOA', 'BWP', 'EGP', 'ERN', 'SZL', 'ETB', 'KES', 'LSL', 'LYD', 'TND', 'MUR', 'MRU', 'MAD', 'MZN', 'NAD', 'STN', 'SCR', 'ZAR', 'ZMW', 'ZWG']) expect(currencyDecimals(currency)).toBe(2)
  })

  it('aucune devise supportée n\'est oubliée', () => {
    expect(Object.keys(CURRENCY_DECIMALS).sort()).toEqual(['AOA', 'BIF', 'BWP', 'CDF', 'CVE', 'DJF', 'DZD', 'EGP', 'ERN', 'ETB', 'FCFA', 'GHS', 'GMD', 'GNF', 'KES', 'KMF', 'LRD', 'LSL', 'LYD', 'MAD', 'MGA', 'MRU', 'MUR', 'MWK', 'MZN', 'NAD', 'NGN', 'RWF', 'SCR', 'SDG', 'SLE', 'SOS', 'SSP', 'STN', 'SZL', 'TND', 'TZS', 'UGX', 'ZAR', 'ZMW', 'ZWG'])
  })

  it('devise inconnue : 0, le comportement historique', () => {
    expect(currencyDecimals('EUR')).toBe(0)
    expect(currencyDecimals('')).toBe(0)
  })
})

describe('formatMoney', () => {
  const nbsp = /[\u00a0\u202f ]/

  it('identique à l\'ancien formatCurrency : fr-FR, 0 décimale, devise à la suite', () => {
    const legacy = (amount: number, currency: string) =>
      `${new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount)} ${currency}`
    for (const amount of [0, 7, 999, 1000, 1234567, 4958571, -2500, 333.333333, 66.5]) {
      expect(formatMoney(amount, 'GNF')).toBe(legacy(amount, 'GNF'))
    }
  })

  it('espace fine comme séparateur de milliers, devise en suffixe', () => {
    expect(formatMoney(1234567, 'GNF')).toMatch(new RegExp('^1' + nbsp.source + '234' + nbsp.source + '567 GNF$'))
  })

  it('arrondit à la précision de la devise (un coût n\'est pas un montant encaissé)', () => {
    expect(formatMoney(333.333333, 'FCFA')).toBe('333 FCFA')
  })

  it('une précision explicite prime (prix de vente réglable par boutique, phase 5bis)', () => {
    expect(formatMoney(333.333333, 'GNF', 'en', 2)).toBe('333.33 GNF')
    expect(formatMoney(350, 'GNF', 'en', 2)).toBe('350.00 GNF')
  })

  it('suit la locale demandée', () => {
    expect(formatMoney(1234.5, 'GNF', 'en', 1)).toBe('1,234.5 GNF')
  })
})

describe('sanitizeMoneyInput — 0 décimale : exactement l\'ancien replace(/[^0-9]/g, \'\')', () => {
  const legacy = (raw: string) => raw.replace(/[^0-9]/g, '')

  it('ne garde que les chiffres, comme avant', () => {
    for (const raw of ['', '12', '1 000', '1.000.000', '1,000', 'abc12def', '12.5', '0', '007', '  3  ']) {
      expect(sanitizeMoneyInput(raw, 0)).toBe(legacy(raw))
    }
  })

  it('un collage formaté garde toute sa valeur : « 1.000.000 » donne 1000000, pas 1', () => {
    expect(sanitizeMoneyInput('1.000.000', 0)).toBe('1000000')
    expect(sanitizeMoneyInput('1 000', 0)).toBe('1000')
  })
})

describe('sanitizeMoneyInput — avec décimales', () => {
  it('accepte la virgule comme le point et renvoie un point décimal', () => {
    expect(sanitizeMoneyInput('12,5', 2)).toBe('12.5')
    expect(sanitizeMoneyInput('12.5', 2)).toBe('12.5')
  })

  it('tronque la partie décimale à la précision demandée', () => {
    expect(sanitizeMoneyInput('12.345', 2)).toBe('12.34')
    expect(sanitizeMoneyInput('0,999', 1)).toBe('0.9')
  })

  it('un seul séparateur compte : le premier', () => {
    expect(sanitizeMoneyInput('1.2.3', 2)).toBe('1.23')
    expect(sanitizeMoneyInput('1,2,3', 2)).toBe('1.23')
  })

  it('« .5 » devient « 0.5 »', () => {
    expect(sanitizeMoneyInput('.5', 2)).toBe('0.5')
    expect(sanitizeMoneyInput(',5', 2)).toBe('0.5')
  })

  it('une saisie en cours est conservée pour pouvoir continuer à taper', () => {
    expect(sanitizeMoneyInput('12.', 2)).toBe('12.')
    expect(sanitizeMoneyInput('12,', 2)).toBe('12.')
  })

  it('ignore tout ce qui n\'est ni chiffre ni séparateur', () => {
    expect(sanitizeMoneyInput('abc', 2)).toBe('')
    expect(sanitizeMoneyInput('1 2a3,4', 2)).toBe('123.4')
    expect(sanitizeMoneyInput('-5', 2)).toBe('5')
  })

  it('entier sans séparateur inchangé', () => {
    expect(sanitizeMoneyInput('1234', 2)).toBe('1234')
    expect(sanitizeMoneyInput('', 2)).toBe('')
  })
})

describe('sanitizeMoneyInput — précision absente ou invalide', () => {
  it('undefined ou NaN retombent sur le mode entiers historique, jamais sur le mode décimal', () => {
    expect(sanitizeMoneyInput('12,5', undefined as unknown as number)).toBe('125')
    expect(sanitizeMoneyInput('12.5', Number.NaN)).toBe('125')
    expect(sanitizeMoneyInput('1.000.000', undefined as unknown as number)).toBe('1000000')
  })
})

describe('parseMoneyInput', () => {
  it('valeur numérique, virgule ou point', () => {
    expect(parseMoneyInput('12.5')).toBe(12.5)
    expect(parseMoneyInput('12,5')).toBe(12.5)
    expect(parseMoneyInput('1000')).toBe(1000)
    expect(parseMoneyInput('12.')).toBe(12)
  })

  it('vide ou invalide : 0, jamais NaN', () => {
    expect(parseMoneyInput('')).toBe(0)
    expect(parseMoneyInput('.')).toBe(0)
    expect(parseMoneyInput('abc')).toBe(0)
  })

  it('aller-retour avec sanitizeMoneyInput, sans dérive de flottant', () => {
    expect(parseMoneyInput(sanitizeMoneyInput('333,33', 2))).toBe(333.33)
    expect(JSON.stringify({ price: parseMoneyInput(sanitizeMoneyInput('0,1', 2)) })).toBe('{"price":0.1}')
  })
})

// ---- Phase 5bis : prix de vente unitaires décimaux ----------------------------------------------------------------------

/** Miroir exact de UnitPrice.times côté serveur (UnitPriceTest) : le client et le serveur DOIVENT trouver le même total. */
describe('unitPriceLineTotal', () => {
  it('3 x 333,33 en GNF = 1 000 (999,99 arrondi UNE fois), pas 999', () => {
    expect(unitPriceLineTotal(333.33, 3, 0)).toBe(1000)
  })

  it('1 x 333,33 en GNF = 333', () => {
    expect(unitPriceLineTotal(333.33, 1, 0)).toBe(333)
  })

  it('un prix entier garde son produit habituel', () => {
    expect(unitPriceLineTotal(400, 3, 0)).toBe(1200)
    expect(unitPriceLineTotal(100000, 2, 0)).toBe(200000)
  })

  it('arrondi commercial (HALF_UP) sur un .5 pile, comme le serveur', () => {
    expect(unitPriceLineTotal(0.5, 1, 0)).toBe(1)
    expect(unitPriceLineTotal(333.5, 1, 0)).toBe(334)
    expect(unitPriceLineTotal(333.49, 1, 0)).toBe(333)
  })

  it('une devise à 2 décimales garde les centimes', () => {
    expect(unitPriceLineTotal(333.33, 3, 2)).toBe(999.99)
    expect(unitPriceLineTotal(19.99, 2, 2)).toBe(39.98)
  })

  it('aucune dérive de flottant : 0,1 x 3 vaut 0,3 et non 0,30000000000000004', () => {
    expect(0.1 * 3).not.toBe(0.3) // ce que donnerait le calcul naïf
    expect(unitPriceLineTotal(0.1, 3, 1)).toBe(0.3)
    expect(unitPriceLineTotal(1.1, 3, 2)).toBe(3.3)
  })

  it('le total d\'une vente est la somme des lignes arrondies : deux lignes à 333,33 font 666, pas 667', () => {
    const lines = [unitPriceLineTotal(333.33, 1, 0), unitPriceLineTotal(333.33, 1, 0), unitPriceLineTotal(333.33, 3, 0)]

    expect(lines.reduce((sum, l) => sum + l, 0)).toBe(1666) // 333 + 333 + 1 000, comme SaleTest côté serveur
  })

  it('quantité 0 : 0', () => {
    expect(unitPriceLineTotal(333.33, 0, 0)).toBe(0)
  })
})

describe('formatSellingPrice', () => {
  it('toujours le même nombre de décimales, pour qu\'une colonne de prix reste alignée', () => {
    expect(formatSellingPrice(400, 'en', 2)).toBe('400.00')
    expect(formatSellingPrice(333.33, 'en', 2)).toBe('333.33')
    expect(formatSellingPrice(333.3, 'en', 1)).toBe('333.3')
  })

  it('à 0 décimale : un entier, comme l\'affichage historique', () => {
    expect(formatSellingPrice(400, 'en', 0)).toBe('400')
    expect(formatSellingPrice(1234567, 'en', 0)).toBe('1,234,567')
  })

  it('suit la locale (virgule décimale en français)', () => {
    expect(formatSellingPrice(333.33, 'fr', 2)).toMatch(/^333,33$/)
  })
})

/** Étude prix décimaux, section 11, phase 7d : méthode de coût de la boutique et avertissement d'arrivage. */
describe('COST_METHODS / isCostMethod', () => {
  it('liste les trois méthodes du serveur, la manuelle en premier (c\'est le défaut)', () => {
    expect(COST_METHODS).toEqual(['MANUAL', 'LAST_PRICE', 'WEIGHTED_AVERAGE'])
  })

  it('reconnaît une méthode valide et refuse tout le reste (serveur ancien, valeur inconnue)', () => {
    expect(isCostMethod('WEIGHTED_AVERAGE')).toBe(true)
    expect(isCostMethod('manual')).toBe(false)
    expect(isCostMethod(undefined)).toBe(false)
    expect(isCostMethod(null)).toBe(false)
    expect(isCostMethod(3)).toBe(false)
  })
})

describe('intakeLineUnitCost', () => {
  it('ligne par lot : prix du lot / unités, à 6 décimales', () => {
    expect(intakeLineUnitCost({ quantity: 3, unitPurchasePrice: 333, packCount: 1, unitsPerPack: 3, packPrice: 1000 })).toBe(333.333333)
  })

  it('ligne à l\'unité : le prix unitaire saisi', () => {
    expect(intakeLineUnitCost({ quantity: 10, unitPurchasePrice: 350 })).toBe(350)
  })

  it('un lot incomplet est ignoré : retombe sur le prix unitaire', () => {
    expect(intakeLineUnitCost({ quantity: 3, unitPurchasePrice: 333, packCount: 1, packPrice: 1000 })).toBe(333)
  })
})

describe('intakeCostIgnored', () => {
  it('méthode manuelle et coût différent de la fiche : prévenir', () => {
    expect(intakeCostIgnored('MANUAL', 400, 300)).toBe(true)
  })

  it('méthode manuelle et même coût : rien à signaler', () => {
    expect(intakeCostIgnored('MANUAL', 300, 300)).toBe(false)
  })

  it('un écart invisible à 2 décimales n\'est pas signalé', () => {
    expect(intakeCostIgnored('MANUAL', 333.333333, 333.33)).toBe(false)
    expect(intakeCostIgnored('MANUAL', 333, 333.333333)).toBe(true) // 333 contre 333,33 : visible
  })

  it('dernier prix et moyenne pondérée appliquent le coût de l\'arrivage : jamais d\'avertissement', () => {
    expect(intakeCostIgnored('LAST_PRICE', 400, 300)).toBe(false)
    expect(intakeCostIgnored('WEIGHTED_AVERAGE', 400, 300)).toBe(false)
  })

  it('méthode absente ou inconnue (serveur ancien) : pas d\'avertissement', () => {
    expect(intakeCostIgnored(undefined, 400, 300)).toBe(false)
    expect(intakeCostIgnored('AUTRE', 400, 300)).toBe(false)
  })
})
