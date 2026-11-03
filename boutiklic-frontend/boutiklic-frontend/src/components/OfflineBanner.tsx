import { WifiOff, RefreshCw } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useOutbox } from '../hooks/useOutbox'
import { networkMonitor } from '../lib/networkMonitor'

export default function OfflineBanner() {
  const { t } = useTranslation()
  const [isOnline, setIsOnline] = useState(true)
  const { pendingCount, isSyncing, sync } = useOutbox()

  useEffect(() => {
    const unsubscribe = networkMonitor.subscribe(setIsOnline)
    networkMonitor.isOnline().then(setIsOnline)
    return unsubscribe
  }, [])

  if (isOnline && pendingCount === 0) return null

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 text-xs font-semibold border-b ${
        isOnline
          ? 'bg-alerte-bg text-alerte-text border-[#EED9AE]'
          : 'bg-info-bg text-info-text border-info-border'
      }`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <>
            <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
            <span>{t('components.offlineBanner.pendingOps', { count: pendingCount })}</span>
          </>
        ) : (
          <>
            <WifiOff size={14} />
            <span>{t('components.offlineBanner.offlineMessage')}</span>
          </>
        )}
      </div>
      {isOnline && (
        <button onClick={sync} disabled={isSyncing} className="font-extrabold underline underline-offset-2 disabled:opacity-50">
          {t('components.offlineBanner.sync')}
        </button>
      )}
    </div>
  )
}
