import { useState } from 'react'
import { View, Text, Pressable, Image, ScrollView, ActivityIndicator, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native'
import { Camera, X } from 'lucide-react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { fileApi } from '../lib/fileApi'
import { toErrorMessage } from '../lib/apiClient'

interface ImageCarouselProps {
  imageUrls: string[]
  /** Appelé avec la galerie déjà mise à jour — enregistrement immédiat côté appelant (fiche
   *  existante, cf. plan images multiples §5), jamais différé à un bouton "Enregistrer". */
  onChange: (next: string[]) => Promise<void> | void
  maxImages?: number
  height?: number
}

/** Fiche produit (ProductDetail) : défilement horizontal paginé, points de pagination, ajout
 *  (multi-sélection, upload immédiat) et suppression directs sur l'image affichée — contrairement à
 *  ImageGalleryEditor (création), pas de bande de vignettes : un seul grand visuel à la fois. */
export default function ImageCarousel({ imageUrls, onChange, maxImages = 8, height = 160 }: ImageCarouselProps) {
  const { t } = useTranslation()
  const [containerWidth, setContainerWidth] = useState(0)
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const atLimit = imageUrls.length >= maxImages
  const currentPage = Math.min(page, Math.max(0, imageUrls.length - 1))

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!containerWidth) return
    setPage(Math.round(e.nativeEvent.contentOffset.x / containerWidth))
  }

  const handleAdd = async () => {
    if (atLimit || busy) return
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
    setBusy(true)
    setError(null)
    try {
      const uploaded = await Promise.all(
        result.assets.map((asset) =>
          fileApi.upload({ uri: asset.uri, name: asset.fileName ?? 'product.jpg', type: asset.mimeType ?? 'image/jpeg' }),
        ),
      )
      await onChange([...imageUrls, ...uploaded.map((u) => u.url)].slice(0, maxImages))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRemove = async () => {
    if (busy || imageUrls.length === 0) return
    const url = imageUrls[currentPage]
    setBusy(true)
    setError(null)
    try {
      await onChange(imageUrls.filter((u) => u !== url))
      setPage((p) => Math.max(0, p - 1))
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setBusy(false)
    }
  }

  if (imageUrls.length === 0) {
    return (
      <View className="w-full rounded-2xl bg-bg-elevated items-center justify-center gap-2 overflow-hidden" style={{ height }}>
        <Text className="text-6xl">📦</Text>
        <Pressable onPress={handleAdd} disabled={busy} className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bg-card border border-border-strong active:scale-95">
          {busy ? <ActivityIndicator size="small" /> : <Camera size={14} color="#676E7E" />}
          <Text className="text-text-muted text-xs font-semibold">{t('inventoryCatalog.addImage')}</Text>
        </Pressable>
        {error && <Text className="text-[11px] font-semibold text-danger px-4 text-center">{error}</Text>}
      </View>
    )
  }

  return (
    <View>
      <View
        className="w-full rounded-2xl bg-bg-elevated overflow-hidden"
        style={{ height }}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {containerWidth > 0 && (
          <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handleScrollEnd}>
            {imageUrls.map((url) => (
              <Image key={url} source={{ uri: url }} style={{ width: containerWidth, height }} resizeMode="cover" />
            ))}
          </ScrollView>
        )}

        {!atLimit && (
          <Pressable
            onPress={handleAdd}
            disabled={busy}
            accessibilityLabel={t('inventoryCatalog.addImage')}
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/60 items-center justify-center"
          >
            {busy ? <ActivityIndicator size="small" color="#fff" /> : <Camera size={15} color="#fff" />}
          </Pressable>
        )}
        <Pressable
          onPress={handleRemove}
          disabled={busy}
          accessibilityLabel={t('inventoryCatalog.removeImage')}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/60 items-center justify-center"
        >
          <X size={15} color="#fff" />
        </Pressable>

        {imageUrls.length > 1 && (
          <View className="absolute bottom-2.5 left-0 right-0 flex-row justify-center gap-1.5">
            {imageUrls.map((url, i) => (
              <View key={url} className={`w-1.5 h-1.5 rounded-full ${i === currentPage ? 'bg-white' : 'bg-white/40'}`} />
            ))}
          </View>
        )}
      </View>
      {error && <Text className="text-[11px] font-semibold text-danger mt-1.5">{error}</Text>}
    </View>
  )
}
