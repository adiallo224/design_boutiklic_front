import { useEffect, useState } from 'react'
import { useOutbox } from '../../hooks/useOutbox'
import { reportingApi } from '../../lib/reportingApi'
import { debtApi } from '../../lib/debtApi'
import { AUTH_CHANGED_EVENT, getActiveTenantId } from '../../lib/session'

const POLL_INTERVAL_MS = 3 * 60 * 1000

export interface HeaderAlertItem {
  key: 'OUT_OF_STOCK' | 'LOW_STOCK' | 'OVERDUE_DEBTS' | 'CASH_NOT_COUNTED' | 'SYNC_PENDING' | 'SYNC_FAILED'
  count: number
  to: string
}

/** Panneau "À traiter" de la cloche du header (TopBar.tsx) — pas de flux de notifications persisté
 *  (aucune entité de ce type côté serveur, aucune infra temps réel nulle part dans l'app), juste un
 *  instantané recalculé périodiquement à partir des signaux déjà affichés ailleurs (Stock, Caisse,
 *  Dettes, Synchro). TopBar est monté en permanence (DesktopLayout) : un polling toutes les 3 min
 *  suffit, pas besoin de refetch-on-focus. */
export function useHeaderAlerts() {
  const { pendingCount, failedCount } = useOutbox()
  const [outOfStockCount, setOutOfStockCount] = useState(0)
  const [lowStockCount, setLowStockCount] = useState(0)
  const [cashNotCounted, setCashNotCounted] = useState(false)
  const [overdueDebtsCount, setOverdueDebtsCount] = useState(0)
  // TopBar reste monté lors d'un changement de boutique : sans suivre la boutique active, les compteurs de la
  // précédente restaient affichés (le polling ne se relançait qu'au montage).
  const [tenantId, setTenantId] = useState(() => getActiveTenantId() ?? '')

  useEffect(() => {
    const onAuthChanged = () => setTenantId(getActiveTenantId() ?? '')
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
  }, [])

  useEffect(() => {
    // Repart de zéro : les chiffres de la boutique précédente ne doivent jamais rester affichés pendant le rechargement.
    setOutOfStockCount(0)
    setLowStockCount(0)
    setCashNotCounted(false)
    setOverdueDebtsCount(0)
    let cancelled = false
    const load = () => {
      reportingApi.getDashboard().then((d) => {
        if (cancelled) return
        setOutOfStockCount(d.outOfStockCount)
        setLowStockCount(d.lowStockCount)
        // Rien à compter tant qu'aucune espèce n'est attendue aujourd'hui (boutique neuve, jour sans
        // vente en espèces). null pour les non-propriétaires : eux ne comptent pas la caisse.
        setCashNotCounted(d.cashGapToday === null && (d.cashExpectedToday ?? 0) > 0)
      }).catch(() => undefined)
      debtApi.getDebtors('urgency').then((debtors) => {
        if (cancelled) return
        setOverdueDebtsCount(debtors.filter((d) => d.urgency === 'OVERDUE').length)
      }).catch(() => undefined)
    }
    load()
    const interval = setInterval(load, POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [tenantId])

  const items: HeaderAlertItem[] = [
    outOfStockCount > 0 && { key: 'OUT_OF_STOCK' as const, count: outOfStockCount, to: '/stock/alertes' },
    lowStockCount > 0 && { key: 'LOW_STOCK' as const, count: lowStockCount, to: '/stock/alertes' },
    overdueDebtsCount > 0 && { key: 'OVERDUE_DEBTS' as const, count: overdueDebtsCount, to: '/clients' },
    cashNotCounted && { key: 'CASH_NOT_COUNTED' as const, count: 1, to: '/caisse/journal' },
    failedCount > 0 && { key: 'SYNC_FAILED' as const, count: failedCount, to: '/reglages?tab=sync' },
    pendingCount > 0 && { key: 'SYNC_PENDING' as const, count: pendingCount, to: '/reglages?tab=sync' },
  ].filter((item): item is HeaderAlertItem => item !== false)

  const total = items.reduce((sum, item) => sum + (item.key === 'CASH_NOT_COUNTED' ? 1 : item.count), 0)

  return { items, total }
}
