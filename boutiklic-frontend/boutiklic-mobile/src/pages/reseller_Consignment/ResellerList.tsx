import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, Plus } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { resellerApi, type ResellerResponse, type ResellersTotalResponse } from '../../lib/resellerApi'
import { toErrorMessage } from '../../lib/apiClient'
import { DiagonalStripes } from '../../components/DiagonalStripes'

interface ResellerListProps {
  onBack: () => void
  onSelectReseller: (reseller: ResellerResponse) => void
  onNewConsignment: () => void
}

type Filter = 'TOUS' | 'RETARD' | 'SOLDES'

function daysAgo(iso: string): number {
  const d = new Date(iso)
  const now = new Date()
  return Math.max(0, Math.round((now.getTime() - d.getTime()) / 86400000))
}

function activitySince(iso: string, t: (key: string, options?: Record<string, unknown>) => string): string {
  const days = daysAgo(iso)
  if (days === 0) return t('resellerConsignment.activityToday')
  if (days === 1) return t('resellerConsignment.activityYesterday')
  return t('resellerConsignment.activityDaysAgo', { count: days })
}

const initials = (name: string) => name.trim().split(/\s+/).map((p) => p[0]).join('').toUpperCase().slice(0, 2)

export default function ResellerList({ onBack, onSelectReseller, onNewConsignment }: ResellerListProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [resellers, setResellers] = useState<ResellerResponse[]>([])
  const [total, setTotal] = useState<ResellersTotalResponse | null>(null)
  const [filter, setFilter] = useState<Filter>('TOUS')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = () => {
    setIsLoading(true)
    setError(null)
    Promise.all([resellerApi.getResellers('late'), resellerApi.getTotal()])
      .then(([r, t]) => {
        setResellers(r)
        setTotal(t)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const lateCount = resellers.filter((r) => r.urgency === 'OVERDUE').length
  const settledCount = resellers.filter((r) => r.settled).length

  const filtered = resellers.filter((r) => {
    if (filter === 'RETARD') return r.urgency === 'OVERDUE'
    if (filter === 'SOLDES') return r.settled
    return true
  })

  return (
    <View className="flex-1 bg-bg">
      <View className="px-5 pt-4 pb-3.5 flex-row items-center gap-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('resellerConsignment.title')}</Text>
          <Text className="text-[13px] font-semibold text-text-muted">{t('resellerConsignment.subtitle')}</Text>
        </View>
        <Pressable onPress={onNewConsignment} className="w-10 h-10 rounded-xl bg-terracotta items-center justify-center">
          <Plus size={19} color="#FFFDFA" />
        </Pressable>
      </View>

      <View className="px-5 pb-3.5">
        <View className="p-[18px] rounded-[20px] bg-terracotta gap-1.5 overflow-hidden relative">
          <DiagonalStripes color="#FFFDFA" opacity={0.06} stripeWidth={3} gap={11} />
          <Text className="text-xs font-extrabold tracking-widest text-papier/70">{t('resellerConsignment.moneyOutside')}</Text>
          <Text className="amount text-[30px] font-extrabold text-papier tracking-tight">{formatNumber(total?.totalOutstanding ?? 0, locale)}</Text>
          <Text className="text-[13px] font-semibold text-papier/80">
            {t('resellerConsignment.resellerCount', { count: total?.resellerCount ?? 0 })} · {t('resellerConsignment.openConsignmentCountSuffix', { count: total?.openConsignmentCount ?? 0 })}
          </Text>
        </View>
      </View>

      <View className="px-5 pb-3 flex-row gap-2">
        <Pressable onPress={() => setFilter('TOUS')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'TOUS' ? 'bg-encre' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'TOUS' ? 'text-papier' : 'text-text-muted'}`}>{t('resellerConsignment.filterAll')}</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('RETARD')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'RETARD' ? 'bg-[#F7E3E1]' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'RETARD' ? 'text-[#8F3B23]' : 'text-text-muted'}`}>{t('resellerConsignment.filterLate')}{lateCount > 0 ? ` ${lateCount}` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('SOLDES')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'SOLDES' ? 'bg-succes-bg' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'SOLDES' ? 'text-succes-text' : 'text-text-muted'}`}>{t('resellerConsignment.filterSettled')}{settledCount > 0 ? ` ${settledCount}` : ''}</Text>
        </Pressable>
      </View>

      {error && <Text className="px-5 pb-2 text-[13px] font-semibold text-danger">{error}</Text>}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('common.loading')}</Text>
        ) : filtered.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('resellerConsignment.emptyState')}</Text>
        ) : (
          filtered.map((r) => {
            const overdue = r.urgency === 'OVERDUE'
            return (
              <Pressable
                key={r.resellerId}
                onPress={() => onSelectReseller(r)}
                className={`flex-row items-center gap-3.5 p-[14px] rounded-[18px] bg-bg-card border ${overdue ? 'border-[#F0C9BC]' : 'border-border'} ${r.settled ? 'opacity-70' : ''}`}
              >
                <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: r.settled ? '#BDB1A3' : overdue ? '#D84E2A' : '#0E2038' }}>
                  <Text className="text-[15px] font-extrabold text-papier">{initials(r.name)}</Text>
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-extrabold" numberOfLines={1}>
                    {r.name}
                  </Text>
                  {r.settled ? (
                    <Text className="text-[12.5px] font-semibold text-text-dim">{t('resellerConsignment.settledSince', { time: activitySince(r.lastActivityAt, t) })}</Text>
                  ) : overdue ? (
                    <View className="flex-row items-center gap-1.5">
                      <View className="px-1.5 py-0.5 rounded-md bg-[#FBE9E4]">
                        <Text className="text-[#D84E2A] text-[11.5px] font-extrabold">{t('resellerConsignment.daysCount', { count: daysAgo(r.lastActivityAt) })}</Text>
                      </View>
                      <Text className="text-[12.5px] font-semibold text-text-dim">
                        {t('resellerConsignment.openConsignmentCount', { count: r.openConsignmentCount })}
                      </Text>
                    </View>
                  ) : (
                    <Text className="text-[12.5px] font-semibold text-text-dim">
                      {t('resellerConsignment.openConsignmentCount', { count: r.openConsignmentCount })} · {t('resellerConsignment.lastActivity', { time: activitySince(r.lastActivityAt, t) })}
                    </Text>
                  )}
                </View>
                {r.settled ? (
                  <View className="px-2.5 py-1.5 rounded-lg bg-succes-bg">
                    <Text className="text-succes-text text-xs font-extrabold">{t('resellerConsignment.upToDate')}</Text>
                  </View>
                ) : (
                  <View className="items-end gap-0.5">
                    <Text className={`amount text-base font-extrabold ${overdue ? 'text-[#D84E2A]' : ''}`}>{formatNumber(r.totalRemaining, locale)}</Text>
                    <Text className={`text-xs font-bold ${overdue ? 'text-[#D84E2A]' : 'text-text-dim'}`}>{overdue ? t('resellerConsignment.overdueLabel') : t('resellerConsignment.toCollectLabel')}</Text>
                  </View>
                )}
              </Pressable>
            )
          })
        )}
      </ScrollView>

      <View className="px-5 pt-1 pb-9">
        <Pressable onPress={onNewConsignment} className="w-full h-[58px] rounded-[18px] bg-encre items-center justify-center flex-row gap-2.5">
          <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
          <Text className="text-papier text-[17px] font-extrabold">{t('resellerConsignment.newConsignmentButton')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
