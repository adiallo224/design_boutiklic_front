import { useEffect } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, RefreshCw, Check, TriangleAlert, X, Info } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import type { QueuedOperation } from '@boutiklic/shared'
import { useOutbox } from '../../hooks/useOutbox'
import { useTenant } from '../../hooks/useTenant'
import { syncEngine } from '../../lib/syncEngine'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import { formatDate, formatTime } from '../../lib/dateFormat'

interface SyncPendingProps {
  onBack: () => void
  onSynced: () => void
}

/** Traduit une opération en attente (n'importe quel type, cf. lib/syncEngine.ts) en un libellé
 *  lisible — le payload est opaque pour le moteur générique, seul cet écran a besoin de savoir le
 *  décoder pour l'affichage. Un type inconnu (futur type d'opération pas encore géré ici) retombe
 *  sur un libellé générique plutôt que de planter. */
function describeOperation(op: QueuedOperation, t: (key: string, options?: Record<string, unknown>) => string, formatCurrency: (n: number) => string) {
  try {
    const payload = JSON.parse(op.payload) as Record<string, unknown>
    switch (op.type) {
      case 'COMPLETE_SALE': {
        const lines = Array.isArray(payload.lines) ? payload.lines.length : 0
        const payments = Array.isArray(payload.payments) ? (payload.payments as { amount?: unknown }[]) : []
        const total = payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
        return { icon: '🧾', title: t('settings.saleLinesCount', { count: lines }), subtitle: formatCurrency(total) }
      }
      case 'CREATE_PRODUCT':
      case 'UPDATE_PRODUCT':
        return { icon: '📦', title: (payload.name as string) || t('settings.operationTypeProduct'), subtitle: t('settings.operationTypeProduct') }
      case 'CREATE_DEBT':
        return { icon: '🤝', title: (payload.customerName as string) || t('settings.operationTypeDebt'), subtitle: t('settings.operationTypeDebt') }
      case 'PAY_DEBT':
        return { icon: '💳', title: t('settings.operationTypeDebtPayment'), subtitle: formatCurrency(Number(payload.amount) || 0) }
      case 'ADJUST_STOCK':
      case 'CHANGE_ALERT_THRESHOLD':
        return { icon: '📊', title: t('settings.operationTypeStock'), subtitle: '' }
      case 'RECORD_STOCK_COUNT_LINES':
        return { icon: '📋', title: t('settings.operationTypeStockCount'), subtitle: '' }
      case 'CREATE_STOCK_INTAKE':
        return { icon: '🚚', title: t('settings.operationTypeIntake'), subtitle: '' }
      case 'CREATE_SUPPLIER':
      case 'PAY_SUPPLIER':
        return { icon: '🏭', title: (payload.name as string) || t('settings.operationTypeSupplier'), subtitle: '' }
      default:
        return { icon: '⏳', title: t('settings.operationTypeGeneric'), subtitle: '' }
    }
  } catch {
    return { icon: '⏳', title: t('settings.operationTypeGeneric'), subtitle: '' }
  }
}

export default function SyncPending({ onBack, onSynced }: SyncPendingProps) {
  const { t } = useTranslation()

  function formatWhen(iso: string): string {
    const date = new Date(iso)
    const sameDay = date.toDateString() === new Date().toDateString()
    const time = formatTime(date)
    return sameDay ? t('settings.todayAt', { time }) : t('settings.dateAt', { date: formatDate(date), time })
  }

  const { formatCurrency } = useTenant()
  const { queue, pendingCount, failedCount, syncLog, isSyncing, sync } = useOutbox()

  useEffect(() => {
    if (queue.length > 0 && pendingCount === 0 && failedCount === 0) onSynced()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queue.length, pendingCount, failedCount])

  const handleSync = async () => {
    const result = await sync()
    if (result.synced > 0 && result.failed === 0) onSynced()
  }

  const lastSync = syncLog[0]

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('settings.sync')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('settings.syncSubtitle')}</Text>
        </View>
      </View>

      <View className="px-5 pb-4">
        <View className="p-5 rounded-[22px] bg-warning gap-3 overflow-hidden relative">
          <DiagonalStripes color="#111418" opacity={0.05} stripeWidth={3} gap={11} />
          <View className="flex-row items-center justify-between">
            <View className="gap-1">
              <Text className="text-xs font-extrabold tracking-widest text-encre/60">{t('settings.pendingSend')}</Text>
              <Text className="amount text-[32px] font-extrabold text-encre tracking-tight">
                {t('settings.operationsCount', { count: queue.length })}
              </Text>
            </View>
            <View className="w-14 h-14 rounded-full bg-encre/10 items-center justify-center">
              <RefreshCw size={26} color="#111418" />
            </View>
          </View>
          <Text className="text-[13px] font-bold text-[#5C4413]">{lastSync ? t('settings.lastSyncSuccess', { when: formatWhen(lastSync.completedAt) }) : t('settings.noSyncYet')}</Text>
        </View>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10 }} showsVerticalScrollIndicator={false}>
        <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.operationsDetail')}</Text>
        {queue.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('settings.nothingPending')}</Text>
        ) : (
          queue.map((op) => {
            const { icon, title, subtitle } = describeOperation(op, t, formatCurrency)
            return (
              <View key={op.operationId} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
                <View className="w-[38px] h-[38px] rounded-xl items-center justify-center" style={{ backgroundColor: op.status === 'FAILED' ? '#F7E3E1' : '#E6F1EC' }}>
                  {op.status === 'FAILED' ? <TriangleAlert size={17} color="#C6362F" /> : <Text className="text-base">{icon}</Text>}
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold" numberOfLines={1}>
                    {title}
                  </Text>
                  <Text className="amount text-[13px] text-text-dim" numberOfLines={1}>
                    {op.status === 'FAILED' ? op.lastError ?? t('settings.failed') : `${formatWhen(op.createdAt)}${subtitle ? ` · ${subtitle}` : ''}`}
                  </Text>
                </View>
                {op.status === 'FAILED' ? (
                  <View className="flex-row gap-1.5">
                    <Pressable onPress={() => syncEngine.retryOperation(op.operationId)} className="px-2.5 py-1 rounded-lg bg-info-bg">
                      <Text className="text-primary text-[11px] font-extrabold">{t('settings.retry')}</Text>
                    </Pressable>
                    <Pressable onPress={() => syncEngine.discardOperation(op.operationId)} className="w-7 h-7 rounded-lg bg-bg-elevated items-center justify-center">
                      <X size={13} color="#A2A9B8" />
                    </Pressable>
                  </View>
                ) : (
                  <View className="px-2.5 py-1 rounded-lg bg-[#FEF4E6]">
                    <Text className="text-[#8A6712] text-[11px] font-extrabold">{t('settings.ready')}</Text>
                  </View>
                )}
              </View>
            )
          })
        )}

        {syncLog.length > 0 && (
          <>
            <Text className="text-xs font-extrabold tracking-widest text-text-dim mt-1.5">{t('settings.alreadySent')}</Text>
            {syncLog.slice(0, 5).map((entry, i) => (
              <View key={i} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
                <View className="w-[38px] h-[38px] rounded-xl bg-succes-bg items-center justify-center">
                  <Check size={18} strokeWidth={3} color="#1F5C43" />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-sm font-bold">{t('settings.saleLabel')} · {formatCurrency(entry.totalAmount)}</Text>
                  <Text className="text-[13px] text-text-dim">{formatWhen(entry.completedAt)}</Text>
                </View>
                <View className="px-2.5 py-1 rounded-lg bg-succes-bg">
                  <Text className="text-succes-text text-[11px] font-extrabold">{t('settings.sync')}</Text>
                </View>
              </View>
            ))}
          </>
        )}

        <View className="mb-2 flex-row gap-3 p-4 rounded-2xl bg-info-bg border border-info-border">
          <Info size={20} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-relaxed text-[#33465E]">
            {t('settings.offlineExplainer')}
          </Text>
        </View>
      </ScrollView>

      <View className="px-5 pt-2 pb-9">
        <Pressable onPress={handleSync} disabled={isSyncing || queue.length === 0} className="w-full h-[62px] rounded-[18px] bg-encre items-center justify-center flex-row gap-2.5 disabled:opacity-70">
          <RefreshCw size={20} color="#FFFDFA" />
          <Text className="text-papier text-lg font-extrabold">{isSyncing ? t('settings.syncing') : t('settings.syncNow')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
