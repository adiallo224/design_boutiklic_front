import { useEffect, useState } from 'react'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { AlertTriangle, ArrowUp, Bell, ChevronDown, ChevronRight, Clock, Plus, RefreshCw, User, type LucideIcon } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { useAuth } from '../../hooks/useAuth'
import { useOutbox } from '../../hooks/useOutbox'
import { reportingApi, type DashboardResponse } from '../../lib/reportingApi'
import { debtApi } from '../../lib/debtApi'
import { toErrorMessage } from '../../lib/apiClient'
import { DiagonalStripes } from '../../components/DiagonalStripes'
import MyProfile from '../store_Settings/MyProfile'
import { formatDate } from '../../lib/dateFormat'

interface HomeProps {
  onNavigateToCashier: () => void
  onNavigateToStock: () => void
  onNavigateToDebts: () => void
  onOpenSettings: () => void
  onOpenShopSwitcher: () => void
}

function pctTrend(today: number, yesterday: number): string | undefined {
  if (yesterday <= 0) return undefined
  const delta = Math.round(((today - yesterday) / yesterday) * 100)
  return `${delta >= 0 ? '+' : ''}${delta}`
}

export default function Home({ onNavigateToCashier, onNavigateToStock, onNavigateToDebts, onOpenSettings, onOpenShopSwitcher }: HomeProps) {
  const { t } = useTranslation()
  const dateLabel = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })
  const { tenant, tenants } = useTenant()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const { pendingCount } = useOutbox()
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [overdueCount, setOverdueCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showProfile, setShowProfile] = useState(false)

  useEffect(() => {
    Promise.all([reportingApi.getDashboard(), debtApi.getDebtors('urgency')])
      .then(([dashboard, debtors]) => {
        setData(dashboard)
        setOverdueCount(debtors.filter((d) => d.urgency === 'OVERDUE').length)
      })
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
      </View>
    )
  }
  if (!data) {
    return (
      <View className="flex-1 bg-bg items-center justify-center px-5">
        <Text className="text-[13px] font-semibold text-danger text-center">{error ?? t('home.loadError')}</Text>
      </View>
    )
  }

  if (showProfile) {
    return <MyProfile onBack={() => setShowProfile(false)} />
  }

  const alerts = [
    (data.outOfStockCount > 0 || data.lowStockCount > 0) && {
      key: 'stock',
      icon: AlertTriangle,
      iconBg: '#FBE9E4',
      iconColor: '#D84E2A',
      title:
        data.outOfStockCount > 0
          ? t('home.alertOutOfStock', { count: data.outOfStockCount })
          : t('home.alertLowStock', { count: data.lowStockCount }),
      onPress: onNavigateToStock,
    },
    overdueCount > 0 && {
      key: 'debts',
      icon: Clock,
      iconBg: '#F4E7D2',
      iconColor: '#8A6A21',
      title: t('home.alertOverdueDebts', { count: overdueCount }),
      onPress: onNavigateToDebts,
    },
    pendingCount > 0 && {
      key: 'sync',
      icon: RefreshCw,
      iconBg: '#EAF0F7',
      iconColor: '#0E2038',
      title: t('home.alertPendingSync', { count: pendingCount }),
      onPress: onOpenSettings,
    },
  ].filter(Boolean) as { key: string; icon: LucideIcon; iconBg: string; iconColor: string; title: string; onPress: () => void }[]

  const hasNotification = alerts.length > 0

  return (
    <ScrollView className="flex-1 bg-bg" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center gap-3 pt-1">
        <Pressable onPress={onOpenShopSwitcher} className="flex-1 flex-row items-center gap-2.5 p-2 rounded-2xl bg-bg-card border border-border-strong">
          <View className="w-[42px] h-[42px] rounded-[13px] bg-primary items-center justify-center overflow-hidden">
            <DiagonalStripes color="#E69D3B" opacity={0.3} stripeWidth={3} gap={8} />
            <View className="w-4 h-4 rounded border-[3px]" style={{ borderColor: '#FFFDFA', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }} />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-[16px] font-extrabold tracking-tight" numberOfLines={1}>
              {tenant.name}
            </Text>
            <Text className="text-xs font-semibold text-text-dim" numberOfLines={1}>
              {tenant.neighborhood ?? tenant.city}
              {tenants.length > 1 ? t('home.shopsCountSuffix', { count: tenants.length }) : ''}
            </Text>
          </View>
          <ChevronDown size={17} color="#676E7E" />
        </Pressable>
        <Pressable onPress={onOpenSettings} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center relative">
          <Bell size={20} strokeWidth={2} color="#111418" />
          {hasNotification && <View className="absolute top-[7px] right-[8px] w-2 h-2 rounded-full bg-terracotta" />}
        </Pressable>
        <Pressable onPress={() => setShowProfile(true)} className="w-[42px] h-[42px] rounded-[13px] bg-primary items-center justify-center">
          <User size={19} color="#FFFDFA" />
        </Pressable>
      </View>

      <Text className="text-sm font-semibold text-text-muted capitalize">{dateLabel} · {t('home.todayOngoing')}</Text>

      <View className="p-[18px] rounded-[20px] bg-primary gap-1.5 relative overflow-hidden">
        <DiagonalStripes color="#E69D3B" opacity={0.16} stripeWidth={4} gap={12} />
        <Text className="text-xs font-extrabold tracking-[.1em] text-[#A9BDD6]">{t('home.salesTodayLabel')}</Text>
        <View className="flex-row items-baseline gap-2">
          <Text className="amount font-display text-[40px] font-extrabold text-papier tracking-tight">{data.salesToday.toLocaleString('fr-FR')}</Text>
          <Text className="text-base font-bold text-[#A9BDD6]">{tenant.currency}</Text>
        </View>
        {pctTrend(data.salesToday, data.salesYesterday) && (
          <View className="flex-row items-center gap-1.5">
            <ArrowUp size={15} strokeWidth={2.6} color="#8FD3B0" />
            <Text className="text-[13px] font-bold text-[#8FD3B0]">
              {t('reportsAnalytics.trendVsYesterday', { value: pctTrend(data.salesToday, data.salesYesterday) })}
            </Text>
          </View>
        )}
      </View>

      <View className={`flex-row gap-2.5 ${!isOwner || data.profitToday === null ? '' : ''}`}>
        {isOwner && data.profitToday !== null && (
          <View className="flex-1 p-3.5 rounded-[18px] bg-bg-card border border-border gap-1">
            <Text className="text-[11.5px] font-extrabold tracking-[.08em] text-text-dim">{t('home.profitLabel')}</Text>
            <Text className="amount text-[22px] font-extrabold tracking-tight">{data.profitToday.toLocaleString('fr-FR')}</Text>
            <Text className="text-xs font-semibold text-success">{t('home.todaySuffix')}</Text>
          </View>
        )}
        <View className="flex-1 p-3.5 rounded-[18px] bg-bg-card border border-border gap-1">
          <Text className="text-[11.5px] font-extrabold tracking-[.08em] text-text-dim">{t('home.debtsLabel')}</Text>
          <Text className="amount text-[22px] font-extrabold tracking-tight">{data.outstandingDebt.toLocaleString('fr-FR')}</Text>
          <Text className="text-xs font-semibold text-terracotta">{t('home.clientsToFollow', { count: data.debtorCount })}</Text>
        </View>
      </View>

      <View className="gap-2 mt-1">
        <View className="flex-row items-center justify-between px-0.5">
          <Text className="text-[15px] font-extrabold">{t('home.sectionToHandle')}</Text>
          {alerts.length > 0 && (
            <View className="px-2 py-0.5 rounded-[7px] bg-[#F4E7D2]">
              <Text className="text-[#8A6712] text-xs font-extrabold">{alerts.length}</Text>
            </View>
          )}
        </View>
        {alerts.length === 0 ? (
          <View className="p-3.5 rounded-2xl bg-bg-card border border-border">
            <Text className="text-[13px] font-semibold text-text-dim text-center">{t('home.allCaughtUp')}</Text>
          </View>
        ) : (
          alerts.map((a) => {
            const Icon = a.icon
            return (
              <Pressable key={a.key} onPress={a.onPress} className="flex-row items-center gap-3 p-3.5 rounded-2xl bg-bg-card border border-border">
                <View className="w-[38px] h-[38px] rounded-xl items-center justify-center" style={{ backgroundColor: a.iconBg }}>
                  <Icon size={19} color={a.iconColor} strokeWidth={2.2} />
                </View>
                <Text className="flex-1 text-[15px] font-bold">{a.title}</Text>
                <ChevronRight size={17} color="#BDB1A3" />
              </Pressable>
            )
          })
        )}
      </View>

      <Pressable
        onPress={onNavigateToCashier}
        className="h-[62px] rounded-[18px] bg-terracotta items-center justify-center flex-row gap-2.5 mt-1 active:scale-[0.98]"
      >
        <Plus size={22} strokeWidth={2.4} color="#FFFDFA" />
        <Text className="text-papier text-lg font-extrabold">{t('home.sellButton')}</Text>
      </Pressable>
    </ScrollView>
  )
}
