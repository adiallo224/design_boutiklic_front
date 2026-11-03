import { describe, expect, it } from 'vitest'
import type { Feature } from '../../lib/entitlementsApi'
import { NAV_ITEMS, visibleNavItems } from './navConfig'

const ids = (items: { id: string }[]) => items.map((i) => i.id)
const grant = (...features: Feature[]) => (f: Feature) => features.includes(f)

describe('visibleNavItems', () => {
  it("le propriétaire d'une offre avec vente en ligne voit « Boutique en ligne »", () => {
    expect(ids(visibleNavItems(NAV_ITEMS, { role: 'OWNER', has: grant('ONLINE_STORE') }))).toContain('online-store')
  })

  it("sans la vente en ligne dans l'offre, l'entrée est masquée (jamais un lien vers un écran refusé)", () => {
    expect(ids(visibleNavItems(NAV_ITEMS, { role: 'OWNER', has: grant('POS') }))).not.toContain('online-store')
  })

  it("un vendeur ne voit pas l'administration des sites, même si l'offre l'inclut (réservée au propriétaire)", () => {
    for (const role of ['SELLER', 'SUPERVISOR', 'APPRENTICE']) {
      expect(ids(visibleNavItems(NAV_ITEMS, { role, has: grant('ONLINE_STORE') })), role).not.toContain('online-store')
    }
  })

  it("« Commandes en ligne » est visible du propriétaire, du vendeur et du superviseur, jamais de l'apprenti ni sans l'offre", () => {
    for (const role of ['OWNER', 'SELLER', 'SUPERVISOR']) expect(ids(visibleNavItems(NAV_ITEMS, { role, has: grant('ONLINE_STORE') })), role).toContain('online-orders')
    expect(ids(visibleNavItems(NAV_ITEMS, { role: 'APPRENTICE', has: grant('ONLINE_STORE') }))).not.toContain('online-orders')
    expect(ids(visibleNavItems(NAV_ITEMS, { role: 'OWNER', has: grant('POS') }))).not.toContain('online-orders')
  })

  it("tant que le rôle ou les droits sont inconnus, rien de soumis à l'offre n'apparaît", () => {
    expect(ids(visibleNavItems(NAV_ITEMS, { role: undefined, has: grant('ONLINE_STORE') }))).not.toContain('online-store')
    expect(ids(visibleNavItems(NAV_ITEMS, { role: 'OWNER', has: () => false }))).not.toContain('online-store')
  })

  it("ne touche jamais aux entrées existantes: toutes restent visibles pour tous les rôles", () => {
    const base = NAV_ITEMS.filter((i) => !i.requiresFeature && !i.roles).map((i) => i.id)
    for (const role of ['OWNER', 'SELLER', undefined]) {
      expect(ids(visibleNavItems(NAV_ITEMS, { role, has: () => false })), String(role)).toEqual(base)
    }
  })

  it('filtre aussi les sous-menus, sans modifier la liste d\'origine', () => {
    const items = [
      { id: 'a', path: '/a', labelKey: 'a', icon: NAV_ITEMS[0].icon, children: [
        { id: 'a1', path: '/a/1', labelKey: 'a1' },
        { id: 'a2', path: '/a/2', labelKey: 'a2', requiresFeature: 'ONLINE_STORE' as Feature },
        { id: 'a3', path: '/a/3', labelKey: 'a3', roles: ['OWNER'] },
      ] },
    ]
    const seller = visibleNavItems(items, { role: 'SELLER', has: grant('ONLINE_STORE') })
    expect(ids(seller[0].children!)).toEqual(['a1', 'a2'])
    expect(ids(visibleNavItems(items, { role: 'OWNER', has: () => false })[0].children!)).toEqual(['a1', 'a3'])
    expect(items[0].children).toHaveLength(3)
  })
})
