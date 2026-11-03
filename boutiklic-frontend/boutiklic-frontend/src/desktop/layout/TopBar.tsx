import { useState } from 'react'
import type { ReactNode } from 'react'
import { Search, RefreshCw, CloudOff, Cloud, CirclePlus, Bell } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { useOutbox } from '../../hooks/useOutbox'
import { useTenant } from '../../hooks/useTenant'
import { useHeaderAlerts } from '../hooks/useHeaderAlerts'
import AlertsMenuDesktop from './AlertsMenuDesktop'

export interface TopBarConfig {
  title?: string
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  /** Entrée pressée dans la recherche — optionnel, pour les écrans où la recherche mène ailleurs
   *  (ex. Tableau de bord -> Stock filtré) plutôt que de filtrer une liste déjà affichée ici même. */
  onSearchSubmit?: (value: string) => void
  primaryAction?: { label: string; onClick: () => void; icon?: ReactNode }
}

/** Bande fixe 74px : titre, recherche, état de synchro, date/boutique, raccourci "Nouvelle vente"
 *  (visible uniquement sur les écrans Stock — demandé explicitement, ce n'est plus un raccourci
 *  global) et la cloche "À traiter" (AlertsMenuDesktop.tsx/useHeaderAlerts.ts) — pas un centre de
 *  notifications persisté (aucune entité de ce type côté API, aucun temps réel nulle part dans
 *  l'app), juste un instantané recalculé périodiquement des signaux déjà affichés ailleurs (stock,
 *  caisse, dettes, synchro). Le contenu par écran arrive via l'outlet context de DesktopLayout, pas
 *  un Context bespoke. L'input de recherche porte un id stable ciblé par le raccourci F2. */
export default function TopBar({ config }: { config: TopBarConfig }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { tenant } = useTenant()
  const { pendingCount, isSyncing } = useOutbox()
  const { items: alertItems, total: alertTotal } = useHeaderAlerts()
  const [alertsOpen, setAlertsOpen] = useState(false)
  const onStockRoute = location.pathname.startsWith('/stock')

  return (
    <header className="desktop-topbar relative min-h-[74px] shrink-0 flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-4 px-3 sm:px-6 py-2 border-b border-border bg-bg-card">
      {config.title && <h1 className="font-display text-base sm:text-lg font-extrabold text-text truncate min-w-0 max-w-[55%] sm:max-w-none">{config.title}</h1>}

      {config.onSearchChange && (
        <div className={`relative flex-1 min-w-[160px] order-last basis-full sm:order-none sm:basis-0 ${config.title ? 'max-w-md' : 'max-w-xl'}`}>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-dim" />
          <input
            id="desktop-topbar-search"
            value={config.searchValue ?? ''}
            onChange={(e) => config.onSearchChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') config.onSearchSubmit?.(config.searchValue ?? '')
            }}
            placeholder={config.searchPlaceholder ?? t('desktopShell.topBar.searchPlaceholder')}
            className="w-full h-10 pl-9 pr-3 rounded-xl border border-border-strong bg-bg font-semibold outline-none focus:border-primary"
          />
        </div>
      )}

      <div className="flex-1 min-w-0" />

      {/* Pastille de synchro : texte complet dès lg, icône seule en dessous (le titre de l'info reste au survol / lecteur d'écran). */}
      <div
        className="flex items-center gap-1.5 p-2 lg:px-3 lg:py-1.5 rounded-full bg-succes-bg text-succes-text text-xs font-extrabold shrink-0"
        title={isSyncing ? t('desktopShell.topBar.syncing') : pendingCount > 0 ? t('desktopShell.topBar.pendingSync', { count: pendingCount }) : `${t('desktopShell.topBar.synced')} · ${t('desktopShell.topBar.offlineReadySuffix')}`}
      >
        {isSyncing ? (
          <>
            <RefreshCw size={14} className="animate-spin" /> <span className="hidden lg:inline">{t('desktopShell.topBar.syncing')}</span>
          </>
        ) : pendingCount > 0 ? (
          <>
            <CloudOff size={14} /> <span className="lg:hidden">{pendingCount}</span>
            <span className="hidden lg:inline">{t('desktopShell.topBar.pendingSync', { count: pendingCount })}</span>
          </>
        ) : (
          <>
            <Cloud size={14} /> <span className="hidden lg:inline">{t('desktopShell.topBar.synced')} · {t('desktopShell.topBar.offlineReadySuffix')}</span>
          </>
        )}
      </div>

      {tenant.city && (
        <div className="hidden xl:flex flex-col text-right shrink-0">
          <span className="text-xs font-semibold text-text-dim">{t('desktopShell.topBar.today')}</span>
          <span className="text-sm font-extrabold text-text">{tenant.city}</span>
        </div>
      )}

      {config.primaryAction && (
        <button
          type="button"
          onClick={config.primaryAction.onClick}
          aria-label={config.primaryAction.label}
          title={config.primaryAction.label}
          className="h-10 px-3 sm:px-4 rounded-xl bg-terracotta text-white font-extrabold text-sm flex items-center gap-2 shrink-0"
        >
          {config.primaryAction.icon}
          <span className="hidden sm:inline">{config.primaryAction.label}</span>
        </button>
      )}

      {onStockRoute && (
        <button
          type="button"
          onClick={() => navigate('/caisse')}
          aria-label={t('desktopShell.topBar.newSaleButton')}
          title={t('desktopShell.topBar.newSaleButton')}
          className="h-10 px-3 sm:px-4 rounded-xl bg-terracotta text-white font-extrabold text-sm flex items-center gap-2 shrink-0"
        >
          <CirclePlus size={16} />
          <span className="hidden sm:inline">{t('desktopShell.topBar.newSaleButton')}</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => setAlertsOpen((v) => !v)}
        className="relative p-2 rounded-lg text-text-dim hover:bg-bg-elevated shrink-0"
      >
        <Bell size={18} />
        {alertTotal > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-terracotta text-white text-[10px] font-extrabold flex items-center justify-center">
            {alertTotal > 9 ? '9+' : alertTotal}
          </span>
        )}
      </button>
      <AlertsMenuDesktop open={alertsOpen} items={alertItems} onClose={() => setAlertsOpen(false)} />
    </header>
  )
}
