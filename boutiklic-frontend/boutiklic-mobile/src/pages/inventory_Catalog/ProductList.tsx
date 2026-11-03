import { useState } from 'react'
import { View, Text, Pressable, TextInput, FlatList, ScrollView } from 'react-native'
import { Search, Camera, Plus, FolderOpen, Truck, History, Tag, Users, AlertTriangle, Warehouse, Printer, ArrowLeftRight, FileDown, ClipboardCheck } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { effectiveUnitCost, type LabelPreselection } from '@boutiklic/shared'
import OfflineBanner from '../../components/OfflineBanner'
import ProductCard from '../../components/ProductCard'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import type { Product } from '../../types'

type Filter = 'TOUS' | 'RUPTURE' | 'ALERTE'

interface ProductListProps {
  products: Product[]
  isLoading: boolean
  error: string | null
  /** Non-null quand loadCatalogWithStock est retombé sur le cache local (cf. lib/productCatalog.ts) —
   *  horodatage ISO du dernier instantané de stock connu, à afficher tel quel à l'utilisateur. */
  stockAsOf?: string | null
  /** Valeur du stock (bandeau) et ajout d'article sont réservés au propriétaire, cf. ProductController.create. */
  isOwner: boolean
  onSelectProduct: (product: Product) => void
  onAdd: () => void
  onOpenCategories: () => void
  onOpenNewArrival: () => void
  onOpenArrivalsList: () => void
  onOpenPromotions: () => void
  onOpenResellers: () => void
  onOpenAlerts: () => void
  onOpenSuppliers: () => void
  onOpenStockTransfers: () => void
  onOpenInventoryExports: () => void
  onOpenStockCounts: () => void
  /** Impression d'étiquettes : réservée au propriétaire et aux vendeurs (comme la modification d'article). */
  canPrintLabels: boolean
  onOpenLabels: () => void
  /** Sélection multiple (appui long) → écran Étiquettes avec ces articles cochés. */
  onPrintLabels: (items: LabelPreselection[]) => void
  /** Précision des prix de vente de la boutique (0 à 2 décimales) — 0 par défaut. */
  sellingPriceDecimals?: number
}

export default function ProductList({
  products,
  isLoading,
  error,
  stockAsOf,
  isOwner,
  onSelectProduct,
  onAdd,
  onOpenCategories,
  onOpenNewArrival,
  onOpenArrivalsList,
  onOpenPromotions,
  onOpenResellers,
  onOpenAlerts,
  onOpenSuppliers,
  onOpenStockTransfers,
  onOpenInventoryExports,
  onOpenStockCounts,
  canPrintLabels,
  onOpenLabels,
  onPrintLabels,
  sellingPriceDecimals = 0,
}: ProductListProps) {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('TOUS')
  const [showScanner, setShowScanner] = useState(false)
  /** Articles cochés pour l'impression d'étiquettes (appui long pour commencer, puis appui simple pour cocher/décocher). */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const selecting = selectedIds.size > 0
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const ruptureCount = products.filter((p) => p.quantity === 0).length
  const alerteCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.alertThreshold).length

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase())
    const matchFilter = filter === 'TOUS' ? true : filter === 'RUPTURE' ? p.quantity === 0 : p.quantity > 0 && p.quantity <= p.alertThreshold
    return matchSearch && matchFilter
  })

  return (
    <View className="flex-1 bg-bg">
      <OfflineBanner />

      <View className="pl-5 pt-1 pb-3.5 flex-row items-center gap-2">
        <View className="shrink gap-0.5 pr-2">
          <Text className="text-[21px] font-extrabold tracking-tight" numberOfLines={1}>
            {t('inventoryCatalog.myStockTitle')}
          </Text>
          <Text className="text-[13px] font-semibold text-text-muted" numberOfLines={1}>
            {t('inventoryCatalog.articleCount', { count: products.length })}
            {isOwner ? ` · ${t('inventoryCatalog.stockValue', { value: (products.reduce((s, p) => s + effectiveUnitCost(p) * p.quantity, 0) / 1000000).toFixed(1) })}` : ''}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          className="shrink"
          contentContainerStyle={{ gap: 8, paddingRight: 20, alignItems: 'center' }}
        >
          <Pressable onPress={onOpenAlerts} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center relative">
            <AlertTriangle size={20} color="#111418" />
            {ruptureCount + alerteCount > 0 && (
              <View className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full items-center justify-center ${ruptureCount > 0 ? 'bg-danger' : 'bg-warning'}`}>
                <Text className="text-[10px] font-extrabold text-papier">{ruptureCount + alerteCount}</Text>
              </View>
            )}
          </Pressable>
          <Pressable onPress={onOpenCategories} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <FolderOpen size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenNewArrival} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <Truck size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenArrivalsList} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <History size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenSuppliers} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <Warehouse size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenStockTransfers} accessibilityLabel={t('inventoryCatalog.stockTransfersTitle')} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <ArrowLeftRight size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenInventoryExports} accessibilityLabel={t('inventoryExports.title')} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <FileDown size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenStockCounts} accessibilityLabel={t('stockCounts.title')} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <ClipboardCheck size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={onOpenPromotions} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <Tag size={20} color="#111418" />
          </Pressable>
          {canPrintLabels && (
            <Pressable onPress={onOpenLabels} accessibilityLabel={t('labels.entry.openLabels')} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
              <Printer size={20} color="#111418" />
            </Pressable>
          )}
          <Pressable onPress={onOpenResellers} className="w-[42px] h-[42px] rounded-[13px] border border-border-strong bg-bg-card items-center justify-center">
            <Users size={20} color="#111418" />
          </Pressable>
          <Pressable onPress={() => setShowScanner(true)} className="w-[42px] h-[42px] rounded-[13px] bg-terracotta items-center justify-center">
            <Camera size={21} color="#FFFDFA" />
          </Pressable>
        </ScrollView>
      </View>

      <View className="px-5 pb-3">
        <View className="h-[52px] rounded-[15px] bg-bg-card border border-border-strong flex-row items-center gap-2.5 px-4">
          <Search size={19} color="#A2A9B8" />
          <TextInput value={searchQuery} onChangeText={setSearchQuery} placeholder={t('inventoryCatalog.searchProductPlaceholder')} className="flex-1 text-base" />
        </View>
      </View>

      <View className="px-5 pb-3.5 flex-row gap-2">
        <Pressable onPress={() => setFilter('TOUS')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'TOUS' ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'TOUS' ? 'text-papier' : 'text-text-muted'}`}>{t('inventoryCatalog.filterAll')}{products.length > 0 ? ` ${products.length}` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('RUPTURE')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'RUPTURE' ? 'bg-[#F7E3E1]' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'RUPTURE' ? 'text-[#8F3B23]' : 'text-text-muted'}`}>{t('inventoryCatalog.filterOutOfStock')}{ruptureCount > 0 ? ` ${ruptureCount}` : ''}</Text>
        </Pressable>
        <Pressable onPress={() => setFilter('ALERTE')} className={`px-4 py-2.5 rounded-[11px] ${filter === 'ALERTE' ? 'bg-alerte-bg' : 'bg-bg-card border border-border-strong'}`}>
          <Text className={`text-sm font-bold ${filter === 'ALERTE' ? 'text-alerte-text' : 'text-text-muted'}`}>{t('inventoryCatalog.filterLowStock')}{alerteCount > 0 ? ` ${alerteCount}` : ''}</Text>
        </Pressable>
      </View>

      {error && <Text className="px-5 pb-3 text-[13px] font-semibold text-danger">{error}</Text>}
      {stockAsOf && (
        <Text className="px-5 pb-3 text-[13px] font-semibold text-info-text">
          {t('inventoryCatalog.stockAsOf', { time: new Date(stockAsOf).toLocaleTimeString() })}
        </Text>
      )}

      {isLoading ? (
        <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('common.loading')}</Text>
      ) : (
        <FlatList
          className="flex-1 px-5"
          data={filtered}
          keyExtractor={(p) => p.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 10 }}
          contentContainerStyle={{ gap: 10, paddingBottom: 8 }}
          extraData={selectedIds}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              selected={selectedIds.has(item.id)}
              onSelect={selecting ? (p) => toggleSelected(p.id) : onSelectProduct}
              onLongPress={canPrintLabels ? () => toggleSelected(item.id) : undefined}
              priceDecimals={sellingPriceDecimals}
            />
          )}
        />
      )}

      {selecting ? (
        <View className="px-5 pt-3 pb-3 gap-2.5 bg-bg-card border-t border-border">
          <Text className="text-[15px] font-extrabold">{t('labels.selection.count', { count: selectedIds.size })}</Text>
          <View className="flex-row gap-2.5">
            <Pressable onPress={() => setSelectedIds(new Set())} className="h-[52px] px-5 rounded-2xl border border-border-strong bg-bg-card items-center justify-center">
              <Text className="font-bold">{t('labels.selection.clear')}</Text>
            </Pressable>
            <Pressable
              onPress={() => onPrintLabels([...selectedIds].map((productId) => ({ productId, copies: 1 })))}
              className="flex-1 h-[52px] rounded-2xl bg-primary flex-row items-center justify-center gap-2"
            >
              <Printer size={18} color="#FFFDFA" />
              <Text className="text-papier font-extrabold">{t('labels.selection.print')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        isOwner && (
        <View className="px-5 pt-3.5 pb-3">
          <Pressable onPress={onAdd} className="w-full h-[58px] rounded-[17px] bg-primary items-center justify-center flex-row gap-2.5">
            <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
            <Text className="text-papier text-[17px] font-extrabold">{t('inventoryCatalog.addProductCta')}</Text>
          </Pressable>
        </View>
        )
      )}

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={(code) => {
          setSearchQuery(code)
          setShowScanner(false)
        }}
      />
    </View>
  )
}
