import { useState, useEffect } from 'react'
import { View, Text, Pressable } from 'react-native'
import { WifiOff, RefreshCw } from 'lucide-react-native'
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
    <View className={`flex-row items-center justify-between px-4 py-2.5 border-b ${isOnline ? 'bg-alerte-bg border-[#EED9AE]' : 'bg-info-bg border-info-border'}`}>
      <View className="flex-row items-center gap-2">
        {isOnline ? (
          <>
            <RefreshCw size={14} color="#8A6712" />
            <Text className="text-xs font-semibold text-alerte-text">{t('components.offlineBanner.pendingOps', { count: pendingCount })}</Text>
          </>
        ) : (
          <>
            <WifiOff size={14} color="#0E2038" />
            <Text className="text-xs font-semibold text-info-text">{t('components.offlineBanner.offlineMessage')}</Text>
          </>
        )}
      </View>
      {isOnline && (
        <Pressable onPress={sync} disabled={isSyncing}>
          <Text className="text-xs font-extrabold text-alerte-text underline" style={{ opacity: isSyncing ? 0.5 : 1 }}>
            {t('components.offlineBanner.sync')}
          </Text>
        </Pressable>
      )}
    </View>
  )
}
