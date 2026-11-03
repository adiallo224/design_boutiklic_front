import { lazy, Suspense, type ReactElement } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import DesktopLayout from './DesktopLayout'
import DesktopShops from '../pages/store_Settings/DesktopShops'
import DesktopDashboard from '../pages/reports_Analytics/DesktopDashboard'
import DesktopStock from '../pages/inventory_Catalog/DesktopStock'
import DesktopArrival from '../pages/inventory_Catalog/DesktopArrival'
import DesktopStockTransfers from '../pages/inventory_Catalog/DesktopStockTransfers'
import DesktopInventoryExports from '../pages/inventory_Catalog/DesktopInventoryExports'
import DesktopStockCounts from '../pages/inventory_Catalog/DesktopStockCounts'
import DesktopStockCountDetail from '../pages/inventory_Catalog/DesktopStockCountDetail'
import DesktopCatalogImport from '../pages/inventory_Catalog/DesktopCatalogImport'
import DesktopAlerts from '../pages/inventory_Catalog/DesktopAlerts'
import DesktopCategories from '../pages/inventory_Catalog/DesktopCategories'
import DesktopLabels from '../pages/inventory_Catalog/DesktopLabels'
import DesktopSuppliers from '../pages/inventory_Catalog/DesktopSuppliers'
import DesktopResellers from '../pages/reseller_Consignment/DesktopResellers'
import DesktopClients from '../pages/debt_Book/DesktopClients'
import DesktopQuotes from '../pages/billing/DesktopQuotes'
import DesktopInvoices from '../pages/billing/DesktopInvoices'
import DesktopCustomers from '../pages/customer/DesktopCustomers'
import DesktopSettings from '../pages/store_Settings/DesktopSettings'
import DesktopMyProfile from '../pages/store_Settings/DesktopMyProfile'
import DesktopStatistics from '../pages/reports_Analytics/DesktopStatistics'
import DesktopCashJournal from '../pages/register_Sales/DesktopCashJournal'
import DesktopSalesHistory from '../pages/register_Sales/DesktopSalesHistory'
import DesktopExportReport from '../pages/reports_Analytics/DesktopExportReport'
import CashierFlow from '../../pages/register_Sales/CashierFlow'

// Réservés au propriétaire d'une offre avec vente en ligne: chargés à la demande pour ne pas alourdir le bundle principal (pré-chargé par la PWA, hors ligne).
const DesktopOnlineStores = lazy(() => import('../pages/online_Store/DesktopOnlineStores'))
const DesktopOnlineStoreDetail = lazy(() => import('../pages/online_Store/DesktopOnlineStoreDetail'))
const DesktopOnlineOrders = lazy(() => import('../pages/online_Store/DesktopOnlineOrders'))
const DesktopOnlineOrderDetail = lazy(() => import('../pages/online_Store/DesktopOnlineOrderDetail'))
const lazyScreen = (element: ReactElement) => <Suspense fallback={<div className="p-8 text-sm font-semibold text-text-dim">…</div>}>{element}</Suspense>

/** Arbre de routes bureau (25 écrans), monté sous AuthenticatedShell quand la largeur ≥1280px.
 *  Routes réelles pour les écrans/master-détail (back/forward, liens profonds, impression) ;
 *  les modales (W13/W14/W16/W20/W21/W23...) restent en état local dans l'écran propriétaire —
 *  voir le plan bureau, section Navigation. */
export default function DesktopShell() {
  return (
    <Routes>
      <Route element={<DesktopLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DesktopDashboard />} />
        <Route path="caisse" element={<CashierFlow />} />
        <Route path="caisse/journal" element={<DesktopCashJournal />} />
        <Route path="caisse/historique" element={<DesktopSalesHistory />} />
        <Route path="stock" element={<DesktopStock />} />
        <Route path="stock/alertes" element={<DesktopAlerts />} />
        <Route path="stock/arrivage" element={<DesktopArrival />} />
        <Route path="stock/transferts" element={<DesktopStockTransfers />} />
        <Route path="stock/exports" element={<DesktopInventoryExports />} />
        <Route path="stock/inventaire" element={<DesktopStockCounts />} />
        <Route path="stock/inventaire/:id" element={<DesktopStockCountDetail />} />
        <Route path="stock/import" element={<DesktopCatalogImport />} />
        <Route path="stock/categories" element={<DesktopCategories />} />
        <Route path="stock/etiquettes" element={<DesktopLabels />} />
        <Route path="revendeurs" element={<DesktopResellers />} />
        <Route path="revendeurs/:id" element={<DesktopResellers />} />
        <Route path="boutiques" element={<DesktopShops />} />
        <Route path="clients" element={<DesktopClients />} />
        <Route path="clients/:phone" element={<DesktopClients />} />
        <Route path="devis" element={<DesktopQuotes />} />
        <Route path="factures" element={<DesktopInvoices />} />
        <Route path="annuaire-clients" element={<DesktopCustomers />} />
        <Route path="statistiques" element={<DesktopStatistics />} />
        <Route path="statistiques/export" element={<DesktopExportReport />} />
        <Route path="fournisseurs" element={<DesktopSuppliers />} />
        <Route path="fournisseurs/:id" element={<DesktopSuppliers />} />
        <Route path="commandes-en-ligne" element={lazyScreen(<DesktopOnlineOrders />)} />
        <Route path="commandes-en-ligne/:id" element={lazyScreen(<DesktopOnlineOrderDetail />)} />
        <Route path="boutique-en-ligne" element={lazyScreen(<DesktopOnlineStores />)} />
        <Route path="boutique-en-ligne/:id" element={lazyScreen(<DesktopOnlineStoreDetail />)} />
        <Route path="reglages" element={<DesktopSettings />} />
        <Route path="mon-offre" element={<Navigate to="/reglages?tab=abonnement" replace />} />
        <Route path="mon-profil" element={<DesktopMyProfile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}
