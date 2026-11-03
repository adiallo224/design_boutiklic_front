import { View, Text, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Check, TriangleAlert } from 'lucide-react-native'
import TaxChoice from '../../components/TaxChoice'

const categories = [
  { id: 'ALIMENTATION', labelKey: 'auth.categoryFood', emoji: '🍚', bg: '#F4E7D2' },
  { id: 'QUINCAILLERIE', labelKey: 'auth.categoryHardware', emoji: '🔧', bg: '#E4EAF2' },
  { id: 'COSMETIQUE', labelKey: 'auth.categoryCosmetics', emoji: '💄', bg: '#F4E3DE' },
  { id: 'TELEPHONIE', labelKey: 'auth.categoryPhones', emoji: '📱', bg: '#E7E2EE' },
  { id: 'HABILLEMENT', labelKey: 'auth.categoryClothing', emoji: '👕', bg: '#E6F1EC' },
  { id: 'AUTRE', labelKey: 'auth.categoryOther', emoji: '➕', bg: '#EDE6D0' },
]

const sizes = [
  { id: 'PETITE', labelKey: 'settings.shopSize.small', descKey: 'auth.sizeSmallDesc', bars: 1 },
  { id: 'MOYENNE', labelKey: 'settings.shopSize.medium', descKey: 'auth.sizeMediumDesc', bars: 2 },
  { id: 'GRANDE', labelKey: 'settings.shopSize.large', descKey: 'auth.sizeLargeDesc', bars: 3 },
]

interface ShopActivityProps {
  onBack: () => void
  category: string
  setCategory: (c: string) => void
  size: 'PETITE' | 'MOYENNE' | 'GRANDE'
  setSize: (s: 'PETITE' | 'MOYENNE' | 'GRANDE') => void
  /** Choix « J'applique la TVA » (Non par défaut) ; masqué quand non fourni. */
  applyTax?: boolean
  setApplyTax?: (value: boolean) => void
  onFinish: () => void
  loading?: boolean
  error?: string | null
}

export default function ShopActivity({ onBack, category, setCategory, size, setSize, applyTax, setApplyTax, onFinish, loading = false, error = null }: ShopActivityProps) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card" />
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.yourBusinessTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.stepFourOfFour')}</Text>
        </View>
      </View>
      <View className="px-[22px] pb-5">
        <View className="h-[5px] rounded-full bg-fond-planche flex-row gap-1">
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ gap: 18 }} showsVerticalScrollIndicator={false}>
        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.whatDoYouSell')}</Text>
          <View className="flex-row flex-wrap gap-2.5">
            {categories.map((c) => {
              const active = category === c.id
              return (
                <Pressable
                  key={c.id}
                  onPress={() => setCategory(c.id)}
                  className={`w-[31%] rounded-2xl py-3.5 px-2.5 items-center gap-1.5 ${
                    active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'
                  }`}
                >
                  <View className="w-11 h-11 rounded-2xl items-center justify-center" style={{ backgroundColor: c.bg }}>
                    <Text className="text-xl">{c.emoji}</Text>
                  </View>
                  <Text className={`text-[13px] text-center leading-tight ${active ? 'font-extrabold text-primary' : 'font-semibold text-[#5C5147]'}`}>
                    {t(c.labelKey)}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </View>

        <View className="gap-2.5">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopSizeLabel')}</Text>
          {sizes.map((s) => {
            const active = size === s.id
            return (
              <Pressable
                key={s.id}
                onPress={() => setSize(s.id as typeof size)}
                className={`flex-row items-center gap-3.5 p-4 rounded-[17px] ${active ? 'border-2 border-primary bg-info-bg' : 'border border-border-strong bg-bg-card'}`}
              >
                <View className={`w-[22px] h-[22px] rounded-full items-center justify-center ${active ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
                  {active && <Check size={13} strokeWidth={3.6} color="#FFFDFA" />}
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className={`text-base ${active ? 'font-extrabold text-primary' : 'font-bold'}`}>{t(s.labelKey)}</Text>
                  <Text className={`text-[13px] ${active ? 'text-[#33465E]' : 'text-text-dim'}`}>{t(s.descKey)}</Text>
                </View>
                <View className="flex-row gap-1 items-end">
                  {[1, 2, 3].map((bar) => (
                    <View
                      key={bar}
                      className="w-1.5 rounded-sm"
                      style={{ height: 6 * bar, backgroundColor: bar <= s.bars ? (active ? '#0E2038' : '#DDD2C3') : '#DDD2C3' }}
                    />
                  ))}
                </View>
              </Pressable>
            )
          })}
        </View>

        {setApplyTax && <TaxChoice applyTax={applyTax ?? false} setApplyTax={setApplyTax} />}

        <View className="flex-row gap-3 p-4 rounded-2xl bg-alerte-bg border border-[#EED9AE]">
          <TriangleAlert size={20} color="#9A7318" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-relaxed text-[#6B5410]">{t('auth.canChangeSizeLaterNotice')}</Text>
        </View>
      </ScrollView>

      <View className="px-[22px] pt-4 pb-10 gap-3">
        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable onPress={onFinish} disabled={loading} className="w-full h-[62px] rounded-[18px] bg-success items-center justify-center disabled:opacity-50">
          <Text className="text-papier text-lg font-extrabold">{loading ? t('auth.creatingInProgress') : t('auth.openMyShop')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
