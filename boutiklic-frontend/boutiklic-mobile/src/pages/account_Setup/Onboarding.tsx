import { useState } from 'react'
import { useRouter } from 'expo-router'
import { View, Text, Pressable, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronLeft, Check } from 'lucide-react-native'
import { LANGUAGES, setLanguage } from '../../lib/language'
import i18n from '../../i18n'

interface Slide {
  titleKey: string
  descriptionKey: string
  swatches: string[]
  ticketLabelKey: string
  ticketValue: string
}

const slides: Slide[] = [
  {
    titleKey: 'auth.slide1Title',
    descriptionKey: 'auth.slide1Description',
    swatches: ['#0E7A52', '#E69D3B', '#D84E2A'],
    ticketLabelKey: 'auth.slide1TicketLabel',
    ticketValue: '85 000',
  },
  {
    titleKey: 'auth.slide2Title',
    descriptionKey: 'auth.slide2Description',
    swatches: ['#E69D3B', '#0E7A52', '#0E2038'],
    ticketLabelKey: 'auth.slide2TicketLabel',
    ticketValue: '45 art.',
  },
  {
    titleKey: 'auth.slide3Title',
    descriptionKey: 'auth.slide3Description',
    swatches: ['#D84E2A', '#0E2038', '#E69D3B'],
    ticketLabelKey: 'auth.slide3TicketLabel',
    ticketValue: '25 000',
  },
]

interface OnboardingProps {
  /** Par défaut : navigue vers /login (route /onboarding, premier lancement de l'app). */
  onFinish?: () => void
  /** Si fourni, affiche un bouton retour (ex. étape 1 d'un assistant de création de boutique). */
  onBack?: () => void
}

export default function Onboarding({ onFinish, onBack }: OnboardingProps) {
  const { t } = useTranslation()
  const [currentSlide, setCurrentSlide] = useState(0)
  const [selectedLang, setSelectedLang] = useState(LANGUAGES[0])
  const [showLangPicker, setShowLangPicker] = useState(false)
  const router = useRouter()

  const finish = async () => {
    await AsyncStorage.setItem('boutiklic_onboarding', 'true')
    await setLanguage(selectedLang.code)
    if (onFinish) onFinish()
    else router.replace('/login')
  }

  const next = () => {
    if (currentSlide < slides.length - 1) setCurrentSlide(currentSlide + 1)
    else finish()
  }

  const slide = slides[currentSlide]
  const insets = useSafeAreaInsets()

  return (
    <View className="flex-1 bg-bg-card" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center justify-between px-6 pt-2 pb-1">
        {onBack ? (
          <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <ChevronLeft size={20} color="#111418" />
          </Pressable>
        ) : (
          <View />
        )}
        <Pressable onPress={finish}>
          <Text className="text-[15px] font-bold text-text-muted">{t('auth.skip')}</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 36, paddingHorizontal: 32 }} showsVerticalScrollIndicator={false}>
        <View className="h-[260px] rounded-[26px] bg-[#F4EDE0] border border-border items-center justify-center overflow-hidden">
          <View className="items-center gap-3.5">
            <View className="w-[150px] h-24 rounded-2xl bg-bg-card border border-border justify-center px-4 gap-2">
              <Text className="text-[11px] font-extrabold text-text-dim tracking-widest">{t(slide.ticketLabelKey)}</Text>
              <Text className="amount text-2xl font-extrabold text-primary">{slide.ticketValue}</Text>
            </View>
            <View className="flex-row gap-2.5">
              {slide.swatches.map((c, i) => (
                <View key={i} className="w-11 h-11 rounded-xl" style={{ backgroundColor: c }} />
              ))}
            </View>
          </View>
        </View>

        <View className="gap-3.5">
          <Text className="font-display font-extrabold text-[32px] leading-[38px] tracking-tight">{t(slide.titleKey)}</Text>
          <Text className="text-[17px] leading-relaxed text-text-muted">{t(slide.descriptionKey)}</Text>
        </View>

        <View className="flex-row gap-2">
          {slides.map((_, idx) => (
            <View key={idx} className={`h-2 rounded-full ${idx === currentSlide ? 'w-[26px] bg-primary' : 'w-2 bg-[#DDD2C3]'}`} />
          ))}
        </View>
      </ScrollView>

      <View className="px-8 pt-6 pb-10 gap-4 relative">
        {showLangPicker && (
          <View className="absolute bottom-full left-8 right-8 mb-2 max-h-[260px] bg-bg-card border border-border rounded-2xl overflow-hidden">
            <ScrollView showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    setSelectedLang(lang)
                    setShowLangPicker(false)
                    i18n.changeLanguage(lang.code)
                  }}
                  className="flex-row items-center justify-between px-4 py-3"
                >
                  <Text className="font-semibold">{lang.name}</Text>
                  {selectedLang.code === lang.code && <Check size={16} color="#0E2038" />}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        )}
        <Pressable
          onPress={() => setShowLangPicker(!showLangPicker)}
          className="h-[52px] px-[18px] rounded-2xl border border-border bg-bg flex-row items-center justify-between"
        >
          <View className="flex-row items-center gap-2.5">
            <Text className="text-[13px] font-extrabold tracking-widest text-text-dim">{t('auth.languageLabel')}</Text>
            <Text className="text-base font-bold">{selectedLang.name}</Text>
          </View>
          <ChevronDown size={18} color="#676E7E" />
        </Pressable>
        <Pressable onPress={next} className="h-[60px] rounded-[18px] bg-primary items-center justify-center active:scale-95">
          <Text className="text-papier text-lg font-bold">{t('auth.continue')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
