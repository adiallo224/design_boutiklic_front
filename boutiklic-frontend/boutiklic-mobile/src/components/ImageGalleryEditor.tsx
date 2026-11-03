import { useState } from 'react'
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator } from 'react-native'
import { Camera, Star, X } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { fileApi } from '../lib/fileApi'
import { toErrorMessage } from '../lib/apiClient'

interface ImageGalleryEditorProps {
  imageUrls: string[]
  onChange: (next: string[]) => void
  maxImages?: number
}

/** Bande de vignettes défilable horizontalement (création, ProductForm) : ajout multi-sélection
 *  (upload immédiat), suppression, définir comme couverture (cf. plan images multiples §3).
 *  Pas de lightbox ici — écran de création, contrairement à ImageCarousel (fiche, ProductDetail). */
export default function ImageGalleryEditor({ imageUrls, onChange, maxImages = 8 }: ImageGalleryEditorProps) {
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atLimit = imageUrls.length >= maxImages

  const handleAdd = async () => {
    if (atLimit || uploading) return
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (!permission.granted) return
    const remaining = maxImages - imageUrls.length
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
    })
    if (result.canceled) return
    setUploading(true)
    setError(null)
    try {
      const uploaded = await Promise.all(
        result.assets.map((asset) =>
          fileApi.upload({ uri: asset.uri, name: asset.fileName ?? 'product.jpg', type: asset.mimeType ?? 'image/jpeg' }),
        ),
      )
      onChange([...imageUrls, ...uploaded.map((u) => u.url)].slice(0, maxImages))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = (url: string) => onChange(imageUrls.filter((u) => u !== url))
  const handleSetCover = (url: string) => onChange([url, ...imageUrls.filter((u) => u !== url)])

  return (
    <View className="gap-2">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {imageUrls.map((url, index) => (
          <View key={url} className="w-24 h-24 rounded-2xl overflow-hidden bg-bg-elevated border border-border-strong">
            <Image source={{ uri: url }} className="w-full h-full" />
            {index === 0 && (
              <View className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md bg-black/60">
                <Text className="text-white text-[9px] font-bold">{t('inventoryCatalog.coverBadge')}</Text>
              </View>
            )}
            {index !== 0 && (
              <Pressable
                onPress={() => handleSetCover(url)}
                accessibilityLabel={t('inventoryCatalog.setAsCover')}
                className="absolute bottom-1 left-1 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
              >
                <Star size={11} color="#fff" />
              </Pressable>
            )}
            <Pressable
              onPress={() => handleRemove(url)}
              accessibilityLabel={t('inventoryCatalog.removeImage')}
              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 items-center justify-center"
            >
              <X size={11} color="#fff" />
            </Pressable>
          </View>
        ))}
        {!atLimit && (
          <Pressable
            onPress={handleAdd}
            disabled={uploading}
            className="w-24 h-24 rounded-2xl border-2 border-dashed border-[#DDD2C3] bg-bg-elevated items-center justify-center gap-1 active:scale-95"
          >
            {uploading ? (
              <ActivityIndicator />
            ) : (
              <>
                <Camera size={22} color="#A2A9B8" />
                <Text className="text-text-muted text-[10px] font-semibold text-center px-1">{t('inventoryCatalog.addImage')}</Text>
              </>
            )}
          </Pressable>
        )}
      </ScrollView>
      {atLimit && <Text className="text-[11px] text-text-dim">{t('inventoryCatalog.imageLimitReached', { max: maxImages })}</Text>}
      {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
    </View>
  )
}
