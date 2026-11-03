import { useState } from 'react'
import { View, Text, Pressable } from 'react-native'
import { useTranslation } from 'react-i18next'
import OfflineBanner from '../../components/OfflineBanner'
import { useAuth } from '../../hooks/useAuth'
import Dashboard from './Dashboard'
import ExportReport from './ExportReport'
import VatReport from './VatReport'
import SalesReports from './SalesReports'

interface StatsFlowProps {
  onNavigateToStock?: () => void
}

export default function StatsFlow({ onNavigateToStock }: StatsFlowProps) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'vat' | 'export' | 'reports'>('dashboard')

  const tabs = [
    { id: 'dashboard' as const, label: t('reportsAnalytics.dashboardTab') },
    // La TVA collectée et le bilan exporté sont des chiffres financiers, réservés au propriétaire.
    { id: 'vat' as const, label: t('reportsAnalytics.vatTab') },
    { id: 'export' as const, label: t('reportsAnalytics.exportTab') },
    { id: 'reports' as const, label: t('reportsAnalytics.salesReportsTab') },
  ]

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />

      {isOwner && (
        <View className="px-5 pt-2.5 pb-3">
          <View className="flex-row p-1 rounded-2xl bg-[#F4EDE0] gap-1">
            {tabs.map((tab) => (
              <Pressable
                key={tab.id}
                onPress={() => setActiveTab(tab.id)}
                className={`flex-1 h-10 rounded-[11px] items-center justify-center ${activeTab === tab.id ? 'bg-primary' : ''}`}
              >
                <Text className={`text-[13px] ${activeTab === tab.id ? 'text-papier font-extrabold' : 'text-text-muted font-bold'}`}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View className="flex-1">
        {activeTab === 'dashboard' && <Dashboard onNavigateToStock={onNavigateToStock} />}
        {activeTab === 'vat' && isOwner && <VatReport />}
        {activeTab === 'export' && isOwner && <ExportReport />}
        {activeTab === 'reports' && isOwner && <SalesReports />}
      </View>
    </View>
  )
}
