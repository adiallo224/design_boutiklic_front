import { View, Text, Pressable, Image } from 'react-native'
import { Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { formatSellingPrice, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import type { Product } from '../types'

interface ProductCardProps {
  product: Product
  onSelect: (product: Product) => void
  /** Appui long : entre dans la sélection multiple (étiquettes) — absent pour un rôle qui ne peut pas imprimer. */
  onLongPress?: () => void
  /** Coché pour l'impression d'étiquettes. */
  selected?: boolean
  /** Précision des prix de vente de la boutique (0 à 2 décimales) — 0 par défaut, comme avant. */
  priceDecimals?: number
}

export default function ProductCard({ product, onSelect, onLongPress, selected = false, priceDecimals = 0 }: ProductCardProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const isOutOfStock = product.quantity === 0
  const isLowStock = !isOutOfStock && product.quantity <= product.alertThreshold

  const baseBorderColor = isOutOfStock ? 'border-[#F0C9C2]' : isLowStock ? 'border-[#EED9AE]' : 'border-border'
  const borderColor = selected ? 'border-primary' : baseBorderColor
  const dotColor = isOutOfStock ? 'bg-danger' : isLowStock ? 'bg-warning' : 'bg-success'
  const stockLabel = isOutOfStock ? t('components.product.outOfStock') : t('components.product.stockCount', { count: product.quantity })
  const stockTextColor = isOutOfStock ? 'text-[#8F3B23] font-bold' : isLowStock ? 'text-[#8A6712]' : 'text-text-muted'

  return (
    <Pressable
      onPress={() => onSelect(product)}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityState={{ selected }}
      className={`flex-1 rounded-[18px] bg-bg-card border overflow-hidden active:scale-95 ${borderColor}`}
    >
      <View className="h-[52px] bg-bg-elevated items-center justify-center relative">
        {selected && (
          <View className="absolute top-2 left-2 z-10 w-6 h-6 rounded-full bg-primary items-center justify-center">
            <Check size={14} color="#FFFDFA" />
          </View>
        )}
        {product.imageUrl ? (
          <Image source={{ uri: product.imageUrl }} className="w-full h-full" />
        ) : (
          <Text className="text-2xl">📦</Text>
        )}
        {isLowStock && (
          <View className="absolute top-2 right-2 px-2 py-0.5 rounded-[7px] bg-warning">
            <Text className="text-encre text-[10px] font-extrabold">{t('components.product.alertBadge')}</Text>
          </View>
        )}
        {isOutOfStock && (
          <View className="absolute top-2 right-2 px-2 py-0.5 rounded-[7px] bg-danger">
            <Text className="text-papier text-[10px] font-extrabold">{t('components.product.stockoutBadge')}</Text>
          </View>
        )}
      </View>
      <View className="px-3 py-2.5 gap-1">
        <Text className="text-sm font-bold leading-tight" numberOfLines={1}>
          {product.name}
        </Text>
        <Text className="amount text-base font-extrabold">{formatSellingPrice(product.salePrice, locale, priceDecimals)}</Text>
        <View className="flex-row items-center gap-1.5">
          <View className={`w-[7px] h-[7px] rounded-full ${dotColor}`} />
          <Text className={`text-xs font-semibold ${stockTextColor}`}>{stockLabel}</Text>
        </View>
      </View>
    </Pressable>
  )
}
