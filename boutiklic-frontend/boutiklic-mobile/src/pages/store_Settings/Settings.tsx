import { View, Text, Pressable, ScrollView } from 'react-native'
import { ChevronLeft, ChevronRight, Users, Shield, Globe, Bell, Database, MessageCircle, RefreshCw, Percent, Printer, Warehouse, Coins, Calculator, Receipt } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../../components/OfflineBanner'
import type { Tenant } from '../../hooks/useTenant'
import { SUPPORT_WHATSAPP_NUMBER } from '../../lib/support'
import { formatDate, formatTime } from '../../lib/dateFormat'

interface SettingsProps {
  tenant: Tenant
  tenantsCount: number
  teamCount: number
  pendingOps: number
  notifStock: boolean
  language: string
  onBack: () => void
  onToggleNotifStock: () => void
  onOpenProfile: () => void
  onOpenTeam: () => void
  onOpenDepots: () => void
  onOpenSecurity: () => void
  onOpenSync: () => void
  onOpenLanguage: () => void
  onOpenDiscountThreshold: () => void
  onOpenSellingPricePrecision: () => void
  onOpenCostMethod: () => void
  onOpenTax: () => void
  onOpenPrinters: () => void
  exportingData: boolean
  lastExportAt: string | null
  onExportData: () => void
  onOpenWhatsAppSupport: () => void
}

export default function Settings({
  tenant,
  tenantsCount,
  teamCount,
  pendingOps,
  notifStock,
  language,
  onBack,
  onToggleNotifStock,
  onOpenProfile,
  onOpenTeam,
  onOpenDepots,
  onOpenSecurity,
  onOpenSync,
  onOpenLanguage,
  onOpenDiscountThreshold,
  onOpenSellingPricePrecision,
  onOpenCostMethod,
  onOpenTax,
  onOpenPrinters,
  exportingData,
  lastExportAt,
  onExportData,
  onOpenWhatsAppSupport,
}: SettingsProps) {
  const { t } = useTranslation()
  const SHOP_SIZE_LABELS: Record<Tenant['shopSize'], string> = {
    PETITE: t('settings.shopSize.small'),
    MOYENNE: t('settings.shopSize.medium'),
    GRANDE: t('settings.shopSize.large'),
  }

  function formatExportDate(iso: string | null): string {
    if (!iso) return t('settings.exportNever')
    return t('settings.exportLast', { date: formatDate(iso, { day: 'numeric', month: 'short' }), time: formatTime(iso) })
  }

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />

      <View className="flex-row items-center gap-3.5 px-5 pt-2.5 pb-3.5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[21px] font-extrabold tracking-tight">{t('settings.title')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 14, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <Pressable onPress={onOpenProfile} className="w-full bg-bg-card rounded-2xl border border-border p-4 flex-row items-center gap-3.5 active:scale-[0.98]">
          <View className="w-14 h-14 rounded-full bg-info-bg items-center justify-center">
            <Text className="text-2xl">🏪</Text>
          </View>
          <View className="flex-1">
            <Text className="text-base font-extrabold" numberOfLines={1}>
              {tenant.name}
            </Text>
            <Text className="text-text-muted text-xs font-semibold">
              {tenant.city} · {tenant.currency}
              {tenantsCount > 1 ? t('home.shopsCountSuffix', { count: tenantsCount }) : ''}
            </Text>
            <View className="flex-row items-center gap-1.5 mt-1.5">
              <View className={`px-2 py-0.5 rounded-full ${tenant.subscription === 'PREMIUM' ? 'bg-info-bg' : 'bg-bg-elevated'}`}>
                <Text className={`text-[10px] font-extrabold ${tenant.subscription === 'PREMIUM' ? 'text-primary' : 'text-text-muted'}`}>
                  {tenant.subscription === 'PREMIUM' ? t('settings.subscriptionPremium') : t('settings.subscriptionFree')}
                </Text>
              </View>
              <View className="px-2 py-0.5 bg-bg-elevated rounded-full">
                <Text className="text-[10px] font-bold text-text-muted">{SHOP_SIZE_LABELS[tenant.shopSize]}</Text>
              </View>
            </View>
          </View>
          <ChevronRight size={18} color="#A2A9B8" />
        </Pressable>

        {pendingOps > 0 && (
          <View className="p-4 rounded-[20px] bg-alerte-bg border border-[#EED9AE] gap-2.5">
            <View className="flex-row items-center gap-2.5">
              <View className="w-[11px] h-[11px] rounded-full bg-warning" />
              <Text className="flex-1 text-base font-extrabold text-[#6B5410]">{t('settings.pendingOpsCount', { count: pendingOps })}</Text>
            </View>
            <Text className="text-sm leading-relaxed text-alerte-text">{t('settings.offlineSalesNotice')}</Text>
            <Pressable onPress={onOpenSync} className="h-12 rounded-[14px] bg-encre items-center justify-center flex-row gap-2">
              <RefreshCw size={18} color="#FFFDFA" />
              <Text className="text-papier text-[15px] font-extrabold">{t('settings.syncNow')}</Text>
            </Pressable>
          </View>
        )}

        <View className="rounded-[20px] border border-border bg-bg-card overflow-hidden">
          <Pressable onPress={onOpenTeam} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Users size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.team')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">
                {t('settings.activeMembersCount', { count: teamCount })}
              </Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenDepots} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Warehouse size={19} color="#0E2038" />
            </View>
            <Text className="flex-1 text-base font-bold">{t('settings.depotsTitle')}</Text>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenSecurity} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Shield size={19} color="#0E2038" />
            </View>
            <Text className="flex-1 text-base font-bold">{t('settings.security')}</Text>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenDiscountThreshold} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Percent size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.discountThreshold')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{t('settings.discountThresholdSummary', { percent: tenant.discountApprovalThresholdPercent })}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenSellingPricePrecision} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Coins size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.sellingPriceDecimalsTitle')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{t('settings.sellingPriceDecimalsSummary', { count: tenant.sellingPriceDecimals })}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenCostMethod} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Calculator size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.costMethodTitle')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{t(`settings.costMethodOption.${tenant.costMethod}`)}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenTax} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Receipt size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.taxTitle')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{tenant.taxEnabled ? t('settings.taxEnabledOn') : t('settings.taxEnabledOff')}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenPrinters} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Printer size={19} color="#0E2038" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('labels.profiles.title')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{t('labels.profiles.rowSubtitle')}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenSync} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className={`w-10 h-10 rounded-xl items-center justify-center ${pendingOps > 0 ? 'bg-alerte-bg' : 'bg-succes-bg'}`}>
              <RefreshCw size={19} color={pendingOps > 0 ? '#8A6712' : '#0E7A52'} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold">{t('settings.sync')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{pendingOps > 0 ? t('settings.syncPendingShort', { count: pendingOps }) : t('settings.syncUpToDate')}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onOpenLanguage} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-info-bg items-center justify-center">
              <Globe size={19} color="#0E2038" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.languageSectionLabel')}</Text>
              <Text className="text-base font-bold">{language}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          <Pressable onPress={onToggleNotifStock} className="flex-row items-center gap-3.5 p-4 border-b border-border-hairline">
            <View className="w-10 h-10 rounded-xl bg-[#F4E3DE] items-center justify-center">
              <Bell size={19} color="#D84E2A" />
            </View>
            <Text className="flex-1 text-base font-bold">{t('settings.lowStockAlerts')}</Text>
            <View className={`w-[52px] h-[31px] rounded-full p-[3px] flex-row ${notifStock ? 'bg-success justify-end' : 'bg-bg-elevated justify-start'}`}>
              <View className="w-[25px] h-[25px] rounded-full bg-papier" />
            </View>
          </Pressable>
          <Pressable onPress={onExportData} disabled={exportingData} className="flex-row items-center gap-3.5 p-4 disabled:opacity-60">
            <View className="w-10 h-10 rounded-xl bg-alerte-bg items-center justify-center">
              <Database size={19} color="#8A6712" />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold">{t('settings.exportData')}</Text>
              <Text className="text-[13px] text-text-dim font-semibold">{exportingData ? t('settings.exportGenerating') : formatExportDate(lastExportAt)}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
        </View>

        <View className="rounded-[20px] border border-border bg-bg-card overflow-hidden">
          <Pressable onPress={onOpenWhatsAppSupport} disabled={!SUPPORT_WHATSAPP_NUMBER} className="flex-row items-center gap-3.5 p-4 disabled:opacity-60">
            <View className="w-10 h-10 rounded-xl bg-succes-bg items-center justify-center">
              <MessageCircle size={19} color="#0E7A52" />
            </View>
            <Text className="flex-1 text-base font-bold">{t('settings.whatsappHelp')}</Text>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
        </View>

        <Text className="text-center text-text-dim text-xs font-semibold pt-1 pb-2">BOUTIKLIC v1.0.4 · Conakry</Text>
      </ScrollView>
    </View>
  )
}
