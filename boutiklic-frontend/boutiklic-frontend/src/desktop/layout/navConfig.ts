import { LayoutDashboard, Calculator, Package, Users, HandCoins, Truck, BarChart3, Settings, FileText, Receipt, Globe, ShoppingBag } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Feature } from '../../lib/entitlementsApi'

export interface NavChild {
  id: string
  path: string
  labelKey: string
  /** Voir NavItem.requiresFeature / roles. */
  requiresFeature?: Feature
  roles?: string[]
}

export interface NavItem {
  id: string
  path: string
  labelKey: string
  icon: LucideIcon
  children?: NavChild[]
  /** Fonction que l'offre de la boutique doit inclure pour que l'entrée apparaisse (le serveur reste seul juge à chaque action). */
  requiresFeature?: Feature
  /** Rôles qui voient l'entrée (absent = tous). Même logique que les permissions serveur, par défaut. */
  roles?: string[]
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', path: '/dashboard', labelKey: 'desktopShell.nav.dashboard', icon: LayoutDashboard },
  {
    id: 'cashier',
    path: '/caisse',
    labelKey: 'desktopShell.nav.cashier',
    icon: Calculator,
    children: [
      { id: 'cashier-history', path: '/caisse/historique', labelKey: 'registerSales.history' },
      { id: 'cashier-journal', path: '/caisse/journal', labelKey: 'registerSales.cashJournalTitle' },
    ],
  },
  {
    id: 'stock',
    path: '/stock',
    labelKey: 'desktopShell.nav.stock',
    icon: Package,
    children: [
      { id: 'stock-import', path: '/stock/import', labelKey: 'inventoryCatalog.importCatalogTitle' },
      { id: 'stock-categories', path: '/stock/categories', labelKey: 'inventoryCatalog.categoriesTitle' },
      { id: 'stock-transfers', path: '/stock/transferts', labelKey: 'inventoryCatalog.stockTransfersTitle' },
      { id: 'stock-counts', path: '/stock/inventaire', labelKey: 'stockCounts.navTitle' },
      { id: 'stock-exports', path: '/stock/exports', labelKey: 'inventoryExports.navTitle' },
      { id: 'stock-labels', path: '/stock/etiquettes', labelKey: 'labels.navTitle' },
    ],
  },
  {
    id: 'suppliers',
    path: '/fournisseurs',
    labelKey: 'desktopShell.nav.suppliers',
    icon: Truck,
    children: [
      { id: 'suppliers-arrival', path: '/stock/arrivage', labelKey: 'inventoryCatalog.newArrivalTitle' },
    ],
  },
  { id: 'resellers', path: '/revendeurs', labelKey: 'desktopShell.nav.resellers', icon: Users },
  {
    id: 'clients',
    path: '/clients',
    labelKey: 'desktopShell.nav.clients',
    icon: HandCoins,
    children: [
      { id: 'clients-directory', path: '/annuaire-clients', labelKey: 'desktopShell.nav.customerDirectory' },
    ],
  },
  { id: 'quotes', path: '/devis', labelKey: 'desktopShell.nav.quotes', icon: FileText },
  { id: 'invoices', path: '/factures', labelKey: 'desktopShell.nav.invoices', icon: Receipt },
  { id: 'online-orders', path: '/commandes-en-ligne', labelKey: 'desktopShell.nav.onlineOrders', icon: ShoppingBag, requiresFeature: 'ONLINE_STORE', roles: ['OWNER', 'SELLER', 'SUPERVISOR'] },
  { id: 'online-store', path: '/boutique-en-ligne', labelKey: 'desktopShell.nav.onlineStore', icon: Globe, requiresFeature: 'ONLINE_STORE', roles: ['OWNER'] },
  { id: 'stats', path: '/statistiques', labelKey: 'desktopShell.nav.stats', icon: BarChart3 },
  { id: 'settings', path: '/reglages', labelKey: 'desktopShell.nav.settings', icon: Settings },
]

/** Entrées du menu visibles pour ce rôle et cette offre. Tant que les droits ne sont pas connus (ou illisibles), les entrées soumises à l'offre sont masquées : jamais de lien vers un écran refusé. */
export function visibleNavItems(items: NavItem[], context: { role: string | undefined; has: (feature: Feature) => boolean }): NavItem[] {
  const allowed = (entry: { requiresFeature?: Feature; roles?: string[] }) =>
    (!entry.requiresFeature || context.has(entry.requiresFeature)) && (!entry.roles || (context.role !== undefined && entry.roles.includes(context.role)))
  return items
    .filter(allowed)
    .map((item) => (item.children ? { ...item, children: item.children.filter(allowed) } : item))
}

export const SHOP_SWITCH_PATH = '/boutiques'
export const MY_PROFILE_PATH = '/mon-profil'
