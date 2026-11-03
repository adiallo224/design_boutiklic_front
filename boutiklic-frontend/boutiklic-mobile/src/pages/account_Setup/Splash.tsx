import { useEffect } from 'react'
import { useRouter } from 'expo-router'
import { View, Text } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useTranslation } from 'react-i18next'
import { DiagonalStripes } from '../../components/DiagonalStripes'

export default function Splash() {
  const { t } = useTranslation()
  const router = useRouter()

  useEffect(() => {
    const timer = setTimeout(async () => {
      const hasOnboarded = await AsyncStorage.getItem('boutiklic_onboarding')
      router.replace(hasOnboarded ? '/login' : '/onboarding')
    }, 2000)
    return () => clearTimeout(timer)
  }, [router])

  return (
    <View className="flex-1 bg-primary">
      <DiagonalStripes width="100%" height="100%" color="#FFFDFA" opacity={0.05} stripeWidth={3} gap={11} />

      <View className="flex-1 items-center justify-center gap-7">
        <View
          className="w-[104px] h-[104px] rounded-[30px] bg-papier items-center justify-center"
          style={{ shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 40, shadowOffset: { width: 0, height: 18 }, elevation: 12 }}
        >
          <View
            className="w-11 h-11 rounded-lg"
            style={{ borderWidth: 6, borderColor: '#0E2038', borderBottomColor: '#E69D3B', borderRightColor: '#E69D3B' }}
          />
        </View>
        <View className="items-center gap-2">
          <Text className="font-display text-papier text-[38px] font-extrabold tracking-tight">BOUTIKLIC</Text>
          <Text className="text-[15px] font-semibold text-papier/70">{t('auth.tagline')}</Text>
        </View>
      </View>

      <View className="px-14 pb-14 items-center gap-4">
        <View className="w-full h-[5px] rounded-full bg-papier/20 overflow-hidden">
          <View className="h-full rounded-full bg-warning" style={{ width: '64%' }} />
        </View>
        <Text className="text-xs font-semibold text-papier/60 tracking-wide">{t('auth.loadingDataVersion')}</Text>
      </View>
    </View>
  )
}
