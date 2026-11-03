import { useState } from 'react'
import { View, Text, Pressable, Image, ScrollView } from 'react-native'
import { ChevronLeft, Inbox } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { categoryIconEmoji } from '@boutiklic/shared'
import type { Product } from '../../types'
import type { CategoryResponse } from '../../lib/categoriesApi'
import { flattenCategoryTree } from '../../lib/categoryTree'
import { productsApi } from '../../lib/productsApi'
import { toErrorMessage } from '../../lib/apiClient'
import SelectField from '../../components/SelectField'

interface UnclassifiedProductsProps {
  categories: CategoryResponse[]
  products: Product[]
  /** Reclasser un article est réservé au propriétaire dans cet écran (lecture seule sinon). */
  isOwner: boolean
  onBack: () => void
  /** Recharge le catalogue après un reclassement. */
  onChanged: () => void | Promise<void>
}

/** Articles sans catégorie (« Non classés ») avec « Classer dans… » — équivalent mobile de l'entrée « Non classés » de l'écran bureau W37. */
export default function UnclassifiedProducts({ categories, products, isOwner, onBack, onChanged }: UnclassifiedProductsProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const unclassified = products.filter((p) => !p.categoryId)
  const options = flattenCategoryTree(categories).map((c) => ({
    label: `${'— '.repeat(c.depth - 1)}${categoryIconEmoji(c.icon)} ${c.name}`,
    value: c.id,
  }))

  const assign = async (productId: string, categoryId: string) => {
    if (!categoryId) return
    setBusyId(productId)
    setError(null)
    try {
      await productsApi.changeCategory(productId, categoryId)
      await onChanged()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusyId(null)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="w-[42px] h-[42px] rounded-2xl bg-bg-elevated items-center justify-center">
          <Inbox size={20} color="#6B7280" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.categoriesScreen.unclassified')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.categoriesScreen.unclassifiedSubtitle', { count: unclassified.length })}</Text>
        </View>
      </View>

      {error && <Text className="px-5 pb-3 text-[13px] font-semibold text-danger">{error}</Text>}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {unclassified.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('inventoryCatalog.categoriesScreen.unclassifiedEmpty')}</Text>
        ) : (
          unclassified.map((product) => (
            <View key={product.id} className="p-[15px] rounded-[17px] bg-bg-card border border-border gap-3" style={{ opacity: busyId === product.id ? 0.5 : 1 }}>
              <View className="flex-row items-center gap-3.5">
                <View className="w-[46px] h-[46px] rounded-2xl bg-bg-elevated items-center justify-center overflow-hidden">
                  {product.imageUrl ? <Image source={{ uri: product.imageUrl }} className="w-full h-full" /> : <Text className="text-xl">📦</Text>}
                </View>
                <Text className="flex-1 text-base font-bold" numberOfLines={2}>
                  {product.name}
                </Text>
              </View>
              {isOwner && options.length > 0 && (
                <SelectField value="" onChange={(categoryId) => assign(product.id, categoryId)} options={options} placeholder={t('inventoryCatalog.categoriesScreen.assignTo')} disabled={busyId === product.id} />
              )}
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}
