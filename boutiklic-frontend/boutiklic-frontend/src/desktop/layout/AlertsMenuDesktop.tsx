import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Archive, Ban, CloudOff, PartyPopper, Wallet } from 'lucide-react'
import type { HeaderAlertItem } from '../hooks/useHeaderAlerts'

interface AlertsMenuDesktopProps {
  open: boolean
  items: HeaderAlertItem[]
  onClose: () => void
}

const ICON: Record<HeaderAlertItem['key'], typeof AlertTriangle> = {
  OUT_OF_STOCK: Ban,
  LOW_STOCK: AlertTriangle,
  OVERDUE_DEBTS: Wallet,
  CASH_NOT_COUNTED: Archive,
  SYNC_PENDING: CloudOff,
  SYNC_FAILED: CloudOff,
}

/** Panneau "À traiter" de la cloche du header — pas un centre de notifications persisté (aucune
 *  entité de ce type côté serveur), juste un raccourci vers les signaux déjà affichés ailleurs dans
 *  l'app (cf. useHeaderAlerts.ts). Même idiome clavier que Modal.tsx (Échap ferme), mais ancré sous
 *  la cloche plutôt que centré. */
export default function AlertsMenuDesktop({ open, items, onClose }: AlertsMenuDesktopProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onPointerDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('mousedown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('mousedown', onPointerDown)
    }
  }, [open, onClose])

  if (!open) return null

  const label = (item: HeaderAlertItem): string => {
    switch (item.key) {
      case 'OUT_OF_STOCK': return t('home.alertOutOfStock', { count: item.count })
      case 'LOW_STOCK': return t('home.alertLowStock', { count: item.count })
      case 'OVERDUE_DEBTS': return t('home.alertOverdueDebts', { count: item.count })
      case 'CASH_NOT_COUNTED': return t('reportsAnalytics.countCashButton')
      case 'SYNC_FAILED': return t('registerSales.failedSyncCaption', { count: item.count })
      case 'SYNC_PENDING': return t('registerSales.pendingSyncCaption', { count: item.count })
    }
  }

  return (
    <div ref={ref} className="absolute top-[64px] right-6 z-50 w-[320px] rounded-2xl bg-bg-card border border-border-strong shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs font-extrabold uppercase tracking-wide text-text-dim">{t('home.sectionToHandle')}</span>
      </div>
      {items.length === 0 ? (
        <div className="px-4 py-6 flex flex-col items-center gap-2 text-center">
          <PartyPopper size={20} className="text-success" />
          <span className="text-sm font-semibold text-text-muted">{t('home.allCaughtUp')}</span>
        </div>
      ) : (
        <ul className="max-h-[360px] overflow-y-auto">
          {items.map((item) => {
            const Icon = ICON[item.key]
            return (
              <li key={item.key} className="border-b border-border-hairline last:border-b-0">
                <button
                  type="button"
                  onClick={() => { navigate(item.to); onClose() }}
                  className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-bg-elevated transition-colors"
                >
                  <span className="w-8 h-8 rounded-lg bg-alerte-bg text-alerte-text flex items-center justify-center flex-none">
                    <Icon size={15} />
                  </span>
                  <span className="text-sm font-semibold text-text">{label(item)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
