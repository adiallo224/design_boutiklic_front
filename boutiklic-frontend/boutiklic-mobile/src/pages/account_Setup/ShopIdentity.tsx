import { useState } from 'react'
import { View, Text, Pressable, TextInput, Image, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { Camera, ChevronLeft, Plus, MapPin } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import * as Location from 'expo-location'
import { fileApi } from '../../lib/fileApi'

interface ShopIdentityProps {
  shopName: string
  setShopName: (v: string) => void
  quartier: string
  setQuartier: (v: string) => void
  logoUrl: string | null
  setLogoUrl: (v: string | null) => void
  latitude: number | null
  longitude: number | null
  accuracyMeters: number | null
  onLocationChange: (latitude: number, longitude: number, accuracyMeters: number) => void
  onContinue: () => void
  onBack: () => void
}

function formatCoordinate(value: number, positiveLabel: string, negativeLabel: string): string {
  return `${Math.abs(value).toFixed(4)}° ${value >= 0 ? positiveLabel : negativeLabel}`
}

export default function ShopIdentity({
  shopName,
  setShopName,
  quartier,
  setQuartier,
  logoUrl,
  setLogoUrl,
  latitude,
  longitude,
  accuracyMeters,
  onLocationChange,
  onContinue,
  onBack,
}: ShopIdentityProps) {
  const { t } = useTranslation()
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [locating, setLocating] = useState(false)
  const [locationError, setLocationError] = useState<string | null>(null)
  const insets = useSafeAreaInsets()

  const handleLocate = async () => {
    setLocationError(null)
    setLocating(true)
    try {
      const permission = await Location.requestForegroundPermissionsAsync()
      if (!permission.granted) {
        setLocationError(t('auth.locationPermissionDenied'))
        return
      }
      const position = await Location.getCurrentPositionAsync({})
      onLocationChange(position.coords.latitude, position.coords.longitude, Math.round(position.coords.accuracy ?? 0))
    } catch {
      setLocationError(t('auth.locationFailed'))
    } finally {
      setLocating(false)
    }
  }

  const handlePickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    })
    if (result.canceled) return
    const asset = result.assets[0]

    setUploadingLogo(true)
    try {
      const { url } = await fileApi.upload({
        uri: asset.uri,
        name: asset.fileName ?? 'logo.jpg',
        type: asset.mimeType ?? 'image/jpeg',
      })
      setLogoUrl(url)
    } finally {
      setUploadingLogo(false)
    }
  }

  return (
    <View className="flex-1 bg-bg" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center gap-3.5 px-[22px] pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('auth.myShopTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('auth.stepThreeOfFour')}</Text>
        </View>
      </View>
      <View className="px-[22px] pb-[22px]">
        <View className="h-[5px] rounded-full bg-fond-planche flex-row gap-1">
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-primary rounded-full" />
          <View className="flex-1 bg-fond-planche rounded-full" />
        </View>
      </View>

      <ScrollView className="flex-1 px-[22px]" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', gap: 22 }} showsVerticalScrollIndicator={false}>
        <View className="items-center gap-2.5">
          <Pressable
            onPress={handlePickLogo}
            disabled={uploadingLogo}
            className="w-[118px] h-[118px] rounded-full bg-[#F4EDE0] border-2 border-dashed border-[#DDD2C3] items-center justify-center relative overflow-hidden disabled:opacity-70"
          >
            {logoUrl ? (
              <Image source={{ uri: logoUrl }} className="w-full h-full" />
            ) : (
              <Camera size={34} strokeWidth={1.7} color="#A2A9B8" />
            )}
            <View className="absolute right-0.5 bottom-1 w-[38px] h-[38px] rounded-full bg-primary border-[3px] border-bg items-center justify-center">
              <Plus size={18} strokeWidth={2.6} color="#FFFDFA" />
            </View>
          </Pressable>
          <Text className="text-sm font-bold text-text-muted">{uploadingLogo ? t('settings.uploading') : t('auth.addShopLogo')}</Text>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('settings.shopNameLabel')}</Text>
          <TextInput
            value={shopName}
            onChangeText={setShopName}
            className="h-[60px] rounded-2xl border-2 border-primary bg-bg-card px-[18px] text-lg font-bold"
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.neighborhoodLabel')}</Text>
          <TextInput
            value={quartier}
            onChangeText={setQuartier}
            className="h-[60px] rounded-2xl border border-border-strong bg-bg-card px-[18px] text-[17px] font-bold"
          />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('auth.exactPositionLabel')}</Text>
          <View className="rounded-2xl border border-border-strong bg-bg-card overflow-hidden">
            <View className="h-[88px] bg-[#E7EDE6] relative items-center justify-center">
              <View className="w-[26px] h-[26px] rounded-full bg-terracotta border-4 border-bg-card" />
            </View>
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="flex-1 gap-0.5">
                <Text className="text-sm font-bold">
                  {latitude != null && longitude != null
                    ? `${formatCoordinate(latitude, 'N', 'S')}, ${formatCoordinate(longitude, 'E', 'O')}`
                    : t('auth.notLocated')}
                </Text>
                <Text className="text-xs font-semibold text-text-dim">{accuracyMeters != null ? t('auth.precisionMeters', { meters: accuracyMeters }) : t('auth.tapToLocate')}</Text>
              </View>
              <Pressable onPress={handleLocate} disabled={locating} className="px-4 py-2.5 rounded-xl bg-success flex-row items-center gap-1.5 disabled:opacity-60">
                <MapPin size={16} color="#FFFDFA" />
                <Text className="text-papier text-sm font-extrabold">{locating ? '...' : t('auth.locate')}</Text>
              </Pressable>
            </View>
          </View>
          {locationError && <Text className="text-[13px] font-semibold text-danger">{locationError}</Text>}
        </View>
      </ScrollView>

      <View className="px-[22px] pt-4 pb-10">
        <Pressable
          onPress={onContinue}
          disabled={!shopName}
          className="w-full h-[62px] rounded-[18px] bg-primary items-center justify-center disabled:opacity-50"
        >
          <Text className="text-papier text-lg font-extrabold">{t('auth.continue')}</Text>
        </Pressable>
      </View>
    </View>
  )
}
