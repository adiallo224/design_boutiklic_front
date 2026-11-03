import { useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, FlatList, Image } from 'react-native'
import { Search, ScanLine, Tag } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatSellingPrice } from '@boutiklic/shared'
import type { Product, SaleLine } from '../../types'
import type { CategoryResponse } from '../../lib/categoriesApi'
import { flattenCategoryTree } from '../../lib/categoryTree'
import type { PromotionResponse } from '../../lib/promotionsApi'
import { resolvePrice } from '../../lib/promotionPricing'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'

interface CashierAdvancedProps {
  searchQuery: string
  setSearchQuery: (v: string) => void
  categories: CategoryResponse[]
  selectedCategory: string
  setSelectedCategory: (v: string) => void
  filteredProducts: Product[]
  activePromotions: PromotionResponse[]
  onAddProduct: (product: Product) => void
  onRemoveProduct: (productId: string) => void
  lines: SaleLine[]
  totalAmount: number
  currency: string
  /** Précision des prix de vente unitaires (0 à 2 décimales) — la devise garde la sienne pour les totaux. */
  sellingPriceDecimals?: number
  onClearCart: () => void
  onValidate: () => void
}

export default function CashierAdvanced({
  searchQuery,
  setSearchQuery,
  categories,
  selectedCategory,
  setSelectedCategory,
  filteredProducts,
  activePromotions,
  onAddProduct,
  onRemoveProduct,
  lines,
  totalAmount,
  currency,
  sellingPriceDecimals = 0,
  onClearCart,
  onValidate,
}: CashierAdvancedProps) {
  const { t } = useTranslation()
  const [showScanner, setShowScanner] = useState(false)
  const pills = [
    { id: 'FAVORIS', label: t('registerSales.favorites') },
    { id: '', label: t('registerSales.allCategories') },
    ...flattenCategoryTree(categories).map((c) => ({ id: c.id, label: c.depth > 1 ? `↳ ${c.name}` : c.name })),
  ]

  return (
    <View className="flex-1">
      <View className="px-5 pb-3.5 flex-row gap-2.5">
        <View className="flex-1 h-14 rounded-2xl bg-bg-card border border-border-strong flex-row items-center gap-2.5 px-4">
          <Search size={19} color="#A2A9B8" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t('registerSales.searchPlaceholder')}
            className="flex-1 text-base"
          />
        </View>
        <Pressable onPress={() => setShowScanner(true)} className="w-14 h-14 rounded-2xl bg-terracotta items-center justify-center">
          <ScanLine size={24} color="#FFFDFA" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="px-5 flex-none"
        contentContainerStyle={{ gap: 8, paddingBottom: 12, alignItems: 'flex-start' }}
      >
        {pills.map((c) => (
          <Pressable
            key={c.id}
            onPress={() => setSelectedCategory(c.id)}
            className={`px-4 py-2.5 rounded-xl ${selectedCategory === c.id ? 'bg-primary' : 'bg-bg-card border border-border-strong'}`}
          >
            <Text className={`text-sm ${selectedCategory === c.id ? 'font-bold text-papier' : 'font-semibold text-[#5C5147]'}`}>{c.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <FlatList
        className="flex-1 px-5"
        data={filteredProducts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
        ListEmptyComponent={<Text className="text-[13px] font-semibold text-text-dim text-center py-6">{t('registerSales.noProductMatch')}</Text>}
        renderItem={({ item: p }) => {
          const qtyInCart = lines.find((l) => l.productId === p.id)?.quantity ?? 0
          const resolved = resolvePrice(p, activePromotions, sellingPriceDecimals)
          const onPromo = resolved.catalogPrice !== null
          return (
            <Pressable
              onPress={() => {
                if (p.quantity > 0) onAddProduct(p)
              }}
              disabled={p.quantity === 0}
              className={`flex-row items-center gap-3 p-2.5 rounded-2xl bg-bg-card ${onPromo ? 'border border-terracotta' : 'border border-border'} disabled:opacity-50`}
            >
              <View className="w-[46px] h-[46px] rounded-[13px] bg-bg-elevated items-center justify-center overflow-hidden">
                {p.imageUrl ? <Image source={{ uri: p.imageUrl }} className="w-full h-full" /> : <Text className="text-2xl">📦</Text>}
              </View>
              <View className="flex-1 gap-0.5">
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-base font-bold" numberOfLines={1}>
                    {p.name}
                  </Text>
                  {onPromo && <Tag size={13} color="#D84E2A" />}
                </View>
                <Text className={`text-[13px] font-semibold ${p.quantity <= p.alertThreshold ? 'text-terracotta' : 'text-text-dim'}`}>
                  {p.quantity === 0 ? t('registerSales.outOfStock') : t('registerSales.stockCount', { count: p.quantity })} {p.quantity > 0 && p.quantity <= p.alertThreshold ? `· ${t('registerSales.lowStockSoon')}` : ''}
                </Text>
              </View>
              <View className="items-end gap-1.5">
                {onPromo ? (
                  <View className="flex-row items-baseline gap-1.5">
                    <Text className="amount text-xs font-semibold text-text-dim line-through">{formatSellingPrice(resolved.catalogPrice!, 'fr', sellingPriceDecimals)}</Text>
                    <Text className="amount text-base font-extrabold text-terracotta">{formatSellingPrice(resolved.unitPrice, 'fr', sellingPriceDecimals)}</Text>
                  </View>
                ) : (
                  <Text className="amount text-base font-extrabold">{formatSellingPrice(p.salePrice, 'fr', sellingPriceDecimals)}</Text>
                )}
                {qtyInCart > 0 ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pressable
                      onPress={() => onRemoveProduct(p.id)}
                      className="w-[34px] h-[34px] rounded-[11px] bg-bg-elevated border border-border-strong items-center justify-center"
                    >
                      <Text className="text-lg font-bold leading-none">−</Text>
                    </Pressable>
                    <Text className="w-5 text-center text-sm font-extrabold text-success">{qtyInCart}</Text>
                    <Pressable
                      onPress={() => onAddProduct(p)}
                      disabled={p.quantity === 0}
                      className="w-[34px] h-[34px] rounded-[11px] bg-primary items-center justify-center disabled:opacity-50"
                    >
                      <Text className="text-papier text-lg font-bold leading-none">+</Text>
                    </Pressable>
                  </View>
                ) : (
                  <View className="w-[34px] h-[34px] rounded-[11px] bg-primary items-center justify-center">
                    <Text className="text-papier text-lg font-bold">+</Text>
                  </View>
                )}
              </View>
            </Pressable>
          )
        }}
      />

      {lines.length > 0 && (
        <View className="mx-4 mt-3 mb-3 p-4 rounded-[20px] bg-primary gap-2.5">
          <View className="flex-row items-baseline justify-between gap-3">
            <Text className="text-xs font-bold text-papier/60 tracking-widest">
              {t('registerSales.cartLabel', { count: lines.length })}
            </Text>
            <Text className="amount text-[26px] font-extrabold text-papier">{totalAmount.toLocaleString('fr-FR')} {currency}</Text>
          </View>
          <View className="flex-row gap-2.5">
            <Pressable onPress={onClearCart} className="flex-1 h-[52px] rounded-2xl bg-papier/15 items-center justify-center">
              <Text className="text-papier text-base font-bold">{t('registerSales.clearCart')}</Text>
            </Pressable>
            <Pressable onPress={onValidate} className="flex-[2] h-[52px] rounded-2xl bg-warning items-center justify-center">
              <Text className="text-encre text-[17px] font-extrabold">{t('registerSales.checkout')}</Text>
            </Pressable>
          </View>
        </View>
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
