import { View, Text, Pressable, FlatList } from 'react-native'
import { ChevronLeft, ShoppingCart } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { useTenant } from '../../hooks/useTenant'
import { formatDate } from '../../lib/dateFormat'
import KpiCard from '../../components/KpiCard'
import { effectiveUnitCost } from '@boutiklic/shared'
import type { Product } from '../../types'

interface StockAlertsProps {
  onBack: () => void
  /** Ouvre "Nouvel arrivage" — même écran que le bouton "Commande" par produit, cf. StockFlow. */
  onOrder: () => void
  products: Product[]
}

/** Écran "Alertes de stock" (liste de courses) — portage mobile de
 *  desktop/pages/inventory_Catalog/DesktopAlerts.tsx (cf. study/plan_parite_mobile_desktop.md,
 *  priorité haute). Contrairement au desktop, ne refait pas d'appel API : `products` vient déjà
 *  assemblé (nom/catégorie/quantité/seuil/dernier réappro) de StockFlow via loadCatalogWithStock,
 *  donc pas d'état de chargement séparé ici — juste un filtre/dérivé de ce qui est déjà en mémoire. */
export default function StockAlerts({ onBack, onOrder, products }: StockAlertsProps) {
  const { t } = useTranslation()
  const { formatCurrency } = useTenant()

  const rows = products.filter((p) => p.quantity <= p.alertThreshold)
  const ruptureRows = rows.filter((p) => p.quantity === 0)
  const lowStockRows = rows.filter((p) => p.quantity > 0)
  const restockCost = rows.reduce((s, p) => s + Math.max(0, p.alertThreshold - p.quantity) * effectiveUnitCost(p), 0)

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('reportsAnalytics.stockAlertsTitle')}</Text>
        </View>
      </View>

      <View className="px-5 pb-3.5 flex-row gap-2.5">
        <View className="flex-1">
          <KpiCard variant="terracotta" label={t('inventoryCatalog.outOfStockBadge')} value={String(ruptureRows.length)} />
        </View>
        <View className="flex-1">
          <KpiCard variant="gold" label={t('inventoryCatalog.stockAlertBadge')} value={String(lowStockRows.length)} />
        </View>
        <View className="flex-1">
          <KpiCard variant="indigo" label={t('inventoryCatalog.restockCostLabel')} value={formatCurrency(restockCost)} />
        </View>
      </View>

      <FlatList
        className="flex-1 px-5"
        data={rows}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 10, paddingBottom: 16 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('home.allCaughtUp')}</Text>}
        renderItem={({ item }) => {
          const isOutOfStock = item.quantity === 0
          return (
            <View className={`p-[15px] rounded-[17px] border flex-row items-center gap-3 ${isOutOfStock ? 'bg-[#FDF1EC] border-[#F0C9C2]' : 'bg-[#FDF6EA] border-[#EED9AE]'}`}>
              <View className="flex-1 gap-0.5">
                <Text className="text-[15px] font-bold" numberOfLines={1}>
                  {item.name}
                </Text>
                <Text className="text-[13px] text-text-dim" numberOfLines={1}>
                  {item.category}
                </Text>
                <Text className="text-[13px] font-semibold text-text-muted">
                  {item.lastRestockAt ? `${t('inventoryCatalog.lastRestockLabel')} · ${formatDate(item.lastRestockAt, { day: 'numeric', month: 'long' })}` : '—'}
                </Text>
              </View>
              <View className="items-end gap-1">
                <Text className={`amount text-base font-extrabold ${isOutOfStock ? 'text-danger' : 'text-[#8A6712]'}`}>
                  {item.quantity} / {item.alertThreshold}
                </Text>
                <Pressable onPress={onOrder} className="px-3 py-1.5 rounded-lg bg-primary flex-row items-center gap-1.5">
                  <ShoppingCart size={12} color="#FFFDFA" />
                  <Text className="text-papier text-xs font-extrabold">{t('inventoryCatalog.order')}</Text>
                </Pressable>
              </View>
            </View>
          )
        }}
      />
    </View>
  )
}
