import AsyncStorage from '@react-native-async-storage/async-storage'
import { clearPendingCounts, loadPendingCounts, removePendingCounts, setPendingCount } from './stockCountDraft'

jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'))

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('brouillon local d\'un inventaire physique', () => {
  it('est vide tant que rien n\'a été saisi hors connexion', async () => {
    expect(await loadPendingCounts('c1')).toEqual({})
  })

  it('retient les saisies par article, la dernière remplaçant la précédente', async () => {
    await setPendingCount('c1', 'rice', 7)
    await setPendingCount('c1', 'oil', 4)
    expect(await setPendingCount('c1', 'rice', 9)).toEqual({ rice: 9, oil: 4 })
    expect(await loadPendingCounts('c1')).toEqual({ rice: 9, oil: 4 })
  })

  it('distingue « retirer le comptage » (null) de « zéro compté »', async () => {
    await setPendingCount('c1', 'rice', 0)
    await setPendingCount('c1', 'oil', null)
    expect(await loadPendingCounts('c1')).toEqual({ rice: 0, oil: null })
  })

  it('garde un brouillon par comptage', async () => {
    await setPendingCount('c1', 'rice', 1)
    await setPendingCount('c2', 'rice', 2)
    expect(await loadPendingCounts('c1')).toEqual({ rice: 1 })
    expect(await loadPendingCounts('c2')).toEqual({ rice: 2 })
  })

  it('retire les saisies envoyées et supprime la clé quand il ne reste rien', async () => {
    await setPendingCount('c1', 'rice', 7)
    await setPendingCount('c1', 'oil', 4)

    expect(await removePendingCounts('c1', ['rice'])).toEqual({ oil: 4 })
    expect(await removePendingCounts('c1', ['oil'])).toEqual({})
    expect(await AsyncStorage.getItem('boutiklic_stock_count_draft_c1')).toBeNull()
  })

  it('clearPendingCounts efface tout le brouillon d\'un comptage', async () => {
    await setPendingCount('c1', 'rice', 7)
    await clearPendingCounts('c1')
    expect(await loadPendingCounts('c1')).toEqual({})
  })

  it('ignore un contenu corrompu ou des valeurs invalides plutôt que de planter', async () => {
    await AsyncStorage.setItem('boutiklic_stock_count_draft_c1', '{pas du json')
    expect(await loadPendingCounts('c1')).toEqual({})

    await AsyncStorage.setItem('boutiklic_stock_count_draft_c1', JSON.stringify({ rice: 3, oil: -1, soap: 2.5, salt: 'x', ok: null }))
    expect(await loadPendingCounts('c1')).toEqual({ rice: 3, ok: null })

    await AsyncStorage.setItem('boutiklic_stock_count_draft_c1', JSON.stringify([1, 2]))
    expect(await loadPendingCounts('c1')).toEqual({})
  })
})
