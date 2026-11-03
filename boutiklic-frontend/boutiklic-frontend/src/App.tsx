import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { isTauri } from '@tauri-apps/api/core'
import { useAuth } from './hooks/useAuth'
import { useIdleTimer } from './hooks/useIdleTimer'
import LockScreen from './components/LockScreen'
import Splash from './pages/account_Setup/Splash'
import LandingPage from './pages/landing_Vitrine/LandingPage'
import BillingCompliancePage from './pages/legal/BillingCompliancePage'
import PrivacyPage from './pages/legal/PrivacyPage'
import TermsPage from './pages/legal/TermsPage'
import LegalNoticePage from './pages/legal/LegalNoticePage'
import ContactPage from './pages/contact/ContactPage'
import Onboarding from './pages/account_Setup/Onboarding'
import AuthFlow from './pages/account_Setup/AuthFlow'
import ShopSetupFlow from './pages/account_Setup/ShopSetupFlow'
import AuthenticatedShell from './desktop/layout/AuthenticatedShell'
import { syncEngine } from './lib/syncEngine'
import { registerCatalogSyncHandlers, backfillCatalogIfEmpty } from './lib/dexie/catalogSync'

function App() {
  const { isAuthenticated, isLoading } = useAuth()
  // Monté ici (racine, hors des routes) pour couvrir toute la app authentifiée quel que soit l'onglet
  // actif dans MainLayout, sans toucher chaque écran individuellement — cf. Sécurité, A4.
  const { locked, unlock } = useIdleTimer(isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) return
    // Amorce le catalogue offline (cf. lib/dexie/catalogSync.ts, plan offline-first Phase 4) et
    // resynchronise à chaque retour réseau — registerChangeHandler est idempotent (Map.set), sûr à
    // rappeler à chaque connexion (changement de compte/boutique compris).
    registerCatalogSyncHandlers()
    backfillCatalogIfEmpty().catch(() => undefined)
    return syncEngine.startAutoSync()
  }, [isAuthenticated])

  return (
    <BrowserRouter>
      {isLoading ? (
        <Splash />
      ) : (
        <Routes>
          {/* Pages publiques : accessibles aussi connecté (liens depuis Réglages > Aide) ; les chemins
              statiques priment sur le /* d'AuthenticatedShell. */}
          <Route path="/mentions-legales" element={<LegalNoticePage />} />
          <Route path="/confidentialite" element={<PrivacyPage />} />
          <Route path="/suppression-compte" element={<PrivacyPage variant="accountDeletion" />} />
          <Route path="/cgv" element={<TermsPage />} />
          <Route path="/conformite-facturation" element={<BillingCompliancePage />} />
          <Route path="/contact" element={<ContactPage />} />
          {!isAuthenticated && (
            <>
              <Route path="/" element={isTauri() ? <Splash /> : <LandingPage />} />
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/login" element={<AuthFlow />} />
              <Route path="/create-shop" element={<ShopSetupFlow />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
          {isAuthenticated && (
            <>
              <Route path="/*" element={<AuthenticatedShell />} />
            </>
          )}
        </Routes>
      )}
      {isAuthenticated && locked && <LockScreen onUnlock={unlock} />}
    </BrowserRouter>
  )
}

export default App
