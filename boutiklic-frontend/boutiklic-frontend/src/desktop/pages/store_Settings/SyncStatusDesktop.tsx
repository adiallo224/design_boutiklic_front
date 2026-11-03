import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock, Cloud, RefreshCw, Wifi, WifiOff } from 'lucide-react'
import { formatDate, formatTime, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useTenant } from '../../../hooks/useTenant'
import { useOutbox } from '../../../hooks/useOutbox'
import { describeOperation } from '../../../lib/describeOperation'
import { networkMonitor } from '../../../lib/networkMonitor'
import Button from '../../components/Button'

/** W24 (tout est à jour) + W40 (synchro en attente) — un seul composant, l'état de la file
 *  (useOutbox) décide de la branche affichée, comme SyncPending.tsx/SyncTab (mobile) le faisaient
 *  déjà séparément. Extrait de DesktopSettings.tsx (onglet "Synchronisation") pour porter le
 *  numéro d'écran de son propre fichier. Ajouts propres au bureau par rapport à l'ancien SyncTab
 *  inline : bandeau d'état réseau réel (networkMonitor, pas juste navigator.onLine) et l'encart
 *  "si le réseau coupe" du spec W40, visible en permanence — pas seulement quand la file est
 *  vide. Pas de réglage "synchro auto" : il n'existe pas de toggle côté code, la synchro
 *  automatique est inconditionnelle (syncEngine.startAutoSync(), cf. App.tsx) — un interrupteur
 *  ici ne changerait rien de réel. */
export default function SyncStatusDesktop() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { formatCurrency } = useTenant()
  const { queue, pendingCount, failedCount, syncLog, isSyncing, sync } = useOutbox()
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    networkMonitor.isOnline().then(setIsOnline)
    return unsubscribe
  }, [])

  function formatWhen(iso: string): string {
    const date = new Date(iso)
    const sameDay = date.toDateString() === new Date().toDateString()
    const time = formatTime(date, locale, { hour: '2-digit', minute: '2-digit' })
    return sameDay ? t('settings.todayAt', { time }) : t('settings.dateAt', { date: formatDate(date, locale), time })
  }

  function formatRelative(iso: string): string {
    const diffMs = Date.now() - new Date(iso).getTime()
    const minutes = Math.round(diffMs / 60000)
    if (minutes < 1) return t('settings.justNow')
    if (minutes < 60) return t('settings.minutesAgo', { count: minutes })
    const hours = Math.round(minutes / 60)
    return t('settings.hoursAgo', { count: hours })
  }

  const allSynced = pendingCount === 0 && failedCount === 0
  const lastSync = syncLog[0]

  return (
    <div className="max-w-2xl flex flex-col gap-6">
      <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold w-fit border ${isOnline ? 'bg-succes-bg border-success/20 text-succes-text' : 'bg-alerte-bg border-alerte-text/20 text-alerte-text'}`}>
        <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-success animate-pulse' : 'bg-warning'}`} />
        {isOnline ? <Wifi size={14} /> : <WifiOff size={14} />}
        {isOnline ? t('settings.online') : t('components.offlineBanner.offlineMessage')}
      </div>

      {allSynced ? (
        <div className="rounded-2xl bg-gradient-to-br from-succes-bg to-succes-bg/40 border border-success/20 p-6 sm:p-7 shadow-sm">
          <div className="flex items-start gap-4 sm:gap-5">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-success text-papier flex items-center justify-center shadow-sm ring-4 ring-succes-bg">
              <Check size={24} strokeWidth={2.8} />
            </div>
            <div className="flex flex-col gap-1.5 pt-0.5">
              <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text">{t('settings.allSynced')}</h1>
              <p className="text-sm font-medium text-succes-text">{t('settings.noPendingOfflineSales')}</p>
              {lastSync && (
                <div className="flex items-center gap-1.5 pt-2 text-xs text-text-muted">
                  <Clock size={14} />
                  <span>{t('settings.lastSyncAt', { when: formatRelative(lastSync.completedAt) })}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl bg-gradient-to-br from-alerte-bg to-alerte-bg/40 border border-warning/30 p-6 sm:p-7 shadow-sm flex flex-col gap-4">
          <div className="flex items-center gap-4 sm:gap-5">
            <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-warning text-encre flex items-center justify-center shadow-sm ring-4 ring-alerte-bg">
              <RefreshCw size={22} className={isSyncing ? 'animate-spin' : ''} />
            </div>
            <div>
              <div className="text-xs font-extrabold tracking-widest text-alerte-text/80 uppercase">{t('settings.pendingSend')}</div>
              <div className="amount text-xl sm:text-2xl font-bold text-text">{t('settings.operationsCount', { count: queue.length })}</div>
            </div>
          </div>
          <div className="h-2 rounded-full bg-encre/10 overflow-hidden">
            <div className="h-full rounded-full bg-warning transition-[width]" style={{ width: `${queue.length === 0 ? 100 : (1 - pendingCount / queue.length) * 100}%` }} />
          </div>
        </div>
      )}

      <Button onClick={() => sync()} disabled={isSyncing || queue.length === 0} loading={isSyncing} className="self-start inline-flex items-center gap-2.5">
        <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
        {t('settings.syncNow')}
      </Button>

      {queue.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.operationsDetail')}</span>
          {queue.map((op) => {
            const { title, subtitle } = describeOperation(op, t, formatCurrency)
            return (
              <div key={op.operationId} className="flex items-center gap-3 p-3 rounded-xl bg-bg-card border border-border">
                <div className="flex-1 text-sm font-bold truncate">{title}</div>
                <div className="text-xs text-text-dim">{op.status === 'FAILED' ? op.lastError ?? t('settings.failed') : formatWhen(op.createdAt)}</div>
                {subtitle && <div className="amount text-sm font-extrabold">{subtitle}</div>}
              </div>
            )
          })}
        </div>
      )}

      {syncLog.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.recentSyncedSales')}</span>
          {syncLog.slice(0, 5).map((entry, i) => (
            <div key={i} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-3 rounded-xl bg-bg-card border border-border">
              <span className="text-sm font-bold">{formatCurrency(entry.totalAmount)}</span>
              <span className="text-xs text-text-dim">{formatWhen(entry.completedAt)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-start gap-3.5 p-5 rounded-2xl bg-info-bg border border-info-border">
        <Cloud size={20} className="text-primary flex-shrink-0 mt-0.5" />
        <div className="text-sm leading-relaxed text-[#33465E]">{t('settings.offlineExplainer')}</div>
      </div>
    </div>
  )
}
