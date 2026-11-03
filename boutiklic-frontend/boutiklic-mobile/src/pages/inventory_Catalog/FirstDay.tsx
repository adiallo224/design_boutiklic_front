import { View, Text, Pressable } from 'react-native'
import { Plus, Check } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DiagonalStripes } from '../../components/DiagonalStripes'

interface FirstDayProps {
  /** Ajouter/importer des articles est réservé au propriétaire, cf. ProductController.create. */
  isOwner: boolean
  onAddFirstProduct: () => void
  onImport: () => void
}

export default function FirstDay({ isOwner, onAddFirstProduct, onImport }: FirstDayProps) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 bg-bg">
      <View className="px-5 pt-1 pb-3.5">
        <Text className="text-[21px] font-extrabold tracking-tight">{t('inventoryCatalog.myStockTitle')}</Text>
        <Text className="text-[13px] font-semibold text-text-muted">{t('inventoryCatalog.noArticlesYet')}</Text>
      </View>

      <View className="flex-1 px-5 justify-center gap-[26px]">
        <View className="h-[196px] rounded-[24px] bg-[#F4EDE0] border border-border-strong items-center justify-center relative overflow-hidden">
          <DiagonalStripes color="#D84E2A" opacity={0.08} stripeWidth={2} gap={16} />
          <View className="flex-row gap-3 items-end">
            <View className="w-14 h-[66px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
            <View className="w-14 h-[92px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
            <View className="w-14 h-[74px] rounded-xl border-2 border-dashed border-[#C9B79E] bg-bg" />
          </View>
          <View className="absolute left-0 right-0 bottom-0 h-3 flex-row">
            <View className="flex-1" style={{ backgroundColor: '#0E2038' }} />
            <View className="flex-1" style={{ backgroundColor: '#E69D3B' }} />
            <View className="flex-1" style={{ backgroundColor: '#D84E2A' }} />
          </View>
        </View>

        <View className="gap-2.5">
          <Text className="font-display text-[27px] font-extrabold leading-[31px] tracking-tight">{t('inventoryCatalog.onboardingHeadline1')}{'\n'}{t('inventoryCatalog.onboardingHeadline2')}</Text>
          <Text className="text-base leading-relaxed text-[#5C5147]">{t('inventoryCatalog.onboardingBody')}</Text>
        </View>

        <View className="gap-2.5">
          <View className="flex-row items-center gap-2.5">
            <View className="w-6 h-6 rounded-lg bg-success items-center justify-center">
              <Check size={13} strokeWidth={3.6} color="#FFFDFA" />
            </View>
            <Text className="text-[15px] font-semibold text-[#5C5147]">{t('inventoryCatalog.stepShopCreated')}</Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <View className="w-6 h-6 rounded-lg border-2 border-[#DDD2C3]" />
            <Text className="text-[15px] font-bold">{t('inventoryCatalog.stepAddFirstProducts')}</Text>
          </View>
          <View className="flex-row items-center gap-2.5">
            <View className="w-6 h-6 rounded-lg border-2 border-[#DDD2C3]" />
            <Text className="text-[15px] font-semibold text-text-dim">{t('inventoryCatalog.stepFirstSale')}</Text>
          </View>
        </View>
      </View>

      <View className="px-5 pt-4 pb-3 gap-2.5">
        {isOwner ? (
          <>
            <Pressable onPress={onAddFirstProduct} className="h-[60px] rounded-[17px] bg-primary items-center justify-center flex-row gap-2.5">
              <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
              <Text className="text-papier text-[17px] font-extrabold">{t('inventoryCatalog.addFirstProductCta')}</Text>
            </Pressable>
            <Pressable onPress={onImport} className="h-[54px] rounded-2xl border border-border-strong bg-bg-card items-center justify-center">
              <Text className="text-base font-bold text-[#5C5147]">{t('inventoryCatalog.importExistingListCta')}</Text>
            </Pressable>
          </>
        ) : (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-2">{t('inventoryCatalog.ownerOnlyNotice')}</Text>
        )}
      </View>
    </View>
  )
}
