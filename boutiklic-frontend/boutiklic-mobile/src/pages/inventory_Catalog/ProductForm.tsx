import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { Check, ChevronLeft, Camera, Save } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, categoryIconEmoji, currencyDecimals, formatUnitCost, isSupportedLocale, roundHalfUp, unitCostFromPack } from '@boutiklic/shared'
import { useTenant } from '../../hooks/useTenant'
import { productsApi } from '../../lib/productsApi'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { flattenCategoryTree } from '../../lib/categoryTree'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import SelectField from '../../components/SelectField'
import MoneyInput from '../../components/MoneyInput'
import BarcodeScannerModal from '../../components/BarcodeScannerModal'
import ImageGalleryEditor from '../../components/ImageGalleryEditor'

interface ProductFormProps {
  onBack: () => void
  onCreated: () => void
  initialCategoryId?: string
}

export default function ProductForm({ onBack, onCreated, initialCategoryId }: ProductFormProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  // Décimales des champs : le prix de VENTE suit le réglage de la boutique (0 à 2, même en GNF/FCFA) ; le prix d'achat et le prix du
  // lot sont des montants payés, ils suivent la précision de la devise.
  const priceDecimals = currencyDecimals(tenant.currency)
  const sellingDecimals = tenant.sellingPriceDecimals
  const [name, setName] = useState('')
  const [salePrice, setSalePrice] = useState('')
  const [purchasePrice, setPurchasePrice] = useState('')
  // Achat par lot (étude prix décimaux, phase 2) : le prix d'achat unitaire est alors dérivé du lot, jamais saisi.
  const [packMode, setPackMode] = useState(false)
  const [packSize, setPackSize] = useState('')
  const [packPrice, setPackPrice] = useState('')
  const [categoryId, setCategoryId] = useState(initialCategoryId ?? '')
  const [stock, setStock] = useState('0')
  const [alertThreshold, setAlertThreshold] = useState('5')
  const [barcode, setBarcode] = useState('')
  const [showScanner, setShowScanner] = useState(false)
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [imageUrls, setImageUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    categoriesApi.getAll().then(setCategories).catch(() => undefined)
  }, [])

  const packSizeNum = Number(packSize) || 0
  const packPriceNum = Number(packPrice) || 0
  /** Coût unitaire EXACT (1 000 / 3 = 333,333333) — affiché tel quel ; le prix d'achat envoyé n'en est que l'arrondi. */
  const unitCost = packMode ? unitCostFromPack(packPriceNum, packSizeNum) : (Number(purchasePrice) || 0)
  const purchase = packMode ? roundHalfUp(unitCost) : (Number(purchasePrice) || 0)
  const packValid = !packMode || (packSizeNum >= 1 && packPrice !== '')
  const canSubmit = name.trim().length > 0 && Number(salePrice) > 0 && purchase >= 0 && packValid && !saving

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      name: name.trim(),
      barcode: barcode.trim() || undefined,
      categoryId: categoryId || undefined,
      purchasePrice: purchase,
      salePrice: Number(salePrice),
      currency: tenant.currency,
      imageUrls,
      initialQuantity: Number(stock) || 0,
      alertThreshold: Number(alertThreshold) || 0,
      ...(packMode ? { packSize: packSizeNum, packPurchasePrice: packPriceNum } : {}),
    }
    try {
      try {
        await productsApi.create(payload)
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts). N'apparaît pas dans le catalogue local
        // avant d'avoir réellement été synchronisé — limitation connue, pas d'écriture optimiste ici.
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CREATE_PRODUCT', JSON.stringify(payload))
      }
      onCreated()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  const categoryOptions = [
    { label: t('inventoryCatalog.noCategory'), value: '' },
    ...flattenCategoryTree(categories).map((c) => ({ label: `${'— '.repeat(c.depth - 1)}${c.icon ? categoryIconEmoji(c.icon) + ' ' : ''}${c.name}`, value: c.id })),
  ]

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.addProductTitle')}</Text>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 14, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <ImageGalleryEditor imageUrls={imageUrls} onChange={setImageUrls} />

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.productNameLabel')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('inventoryCatalog.productNamePlaceholder')} className="h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 text-base font-semibold" />
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.categoryLabel')}</Text>
          <SelectField value={categoryId} onChange={setCategoryId} options={categoryOptions} disabled={!!initialCategoryId} placeholder={t('inventoryCatalog.noCategory')} />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.salePriceUpperLabel')}</Text>
            <MoneyInput value={salePrice} onValueChange={setSalePrice} decimals={sellingDecimals} placeholder="0" className="amount h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-extrabold" />
          </View>
          {packMode ? (
            <View className="flex-1 gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.unitCostLabel').toUpperCase()}</Text>
              <View className="h-[54px] rounded-2xl border border-border bg-bg-elevated px-4 justify-center">
                <Text testID="pack-unit-cost" className="amount font-extrabold">
                  {packValid && packPrice !== '' ? `${formatUnitCost(unitCost, locale)} ${tenant.currency}` : '—'}
                </Text>
              </View>
            </View>
          ) : (
            <View className="flex-1 gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.purchasePriceUpperLabel')}</Text>
              <MoneyInput value={purchasePrice} onValueChange={setPurchasePrice} decimals={priceDecimals} placeholder="0" className="amount h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-extrabold" />
            </View>
          )}
        </View>

        <Pressable onPress={() => setPackMode((v) => !v)} accessibilityRole="checkbox" accessibilityState={{ checked: packMode }} className="flex-row items-center gap-2.5">
          <View className={`w-[22px] h-[22px] rounded-md border-2 items-center justify-center ${packMode ? 'bg-primary border-primary' : 'border-border-strong bg-bg-card'}`}>
            {packMode && <Check size={14} color="#FFFDFA" />}
          </View>
          <Text className="text-sm font-semibold">{t('inventoryCatalog.packToggleLabel')}</Text>
        </Pressable>

        {packMode && (
          <View className="flex-row gap-3">
            <View className="flex-1 gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.packSizeLabel').toUpperCase()}</Text>
              <TextInput keyboardType="number-pad" value={packSize} onChangeText={(v: string) => setPackSize(v.replace(/[^0-9]/g, ''))} placeholder="3" className="amount h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-extrabold" />
            </View>
            <View className="flex-1 gap-2">
              <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.packPriceLabel').toUpperCase()}</Text>
              <MoneyInput value={packPrice} onValueChange={setPackPrice} decimals={priceDecimals} placeholder="0" className="amount h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-extrabold" />
            </View>
          </View>
        )}

        <View className="flex-row gap-3">
          <View className="flex-1 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.initialStockLabel')}</Text>
            <TextInput keyboardType="number-pad" value={stock} onChangeText={setStock} className="h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold" />
          </View>
          <View className="flex-1 gap-2">
            <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.alertThresholdUpperLabel')}</Text>
            <TextInput keyboardType="number-pad" value={alertThreshold} onChangeText={setAlertThreshold} className="h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 font-semibold" />
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-xs font-extrabold tracking-widest text-text-dim">{t('inventoryCatalog.barcodeOptionalLabel')}</Text>
          <View className="flex-row gap-2.5">
            <TextInput
              value={barcode}
              onChangeText={setBarcode}
              placeholder={t('inventoryCatalog.enterManuallyPlaceholder')}
              className="flex-1 h-[54px] rounded-2xl border border-border-strong bg-bg-card px-4 text-base font-semibold"
            />
            <Pressable
              onPress={() => setShowScanner(true)}
              className="w-[54px] h-[54px] rounded-2xl border border-border-strong bg-bg-card items-center justify-center active:scale-95"
            >
              <Camera size={20} color="#676E7E" />
            </Pressable>
          </View>
        </View>

        {error && <Text className="text-[13px] font-semibold text-danger text-center">{error}</Text>}
        <Pressable onPress={handleSave} disabled={!canSubmit} className="w-full bg-success py-4 rounded-2xl items-center flex-row justify-center gap-2 active:scale-95 mt-1 disabled:opacity-50">
          <Save size={20} color="#FFFDFA" />
          <Text className="text-papier font-extrabold">{saving ? t('inventoryCatalog.saving') : t('inventoryCatalog.saveProduct')}</Text>
        </Pressable>
      </ScrollView>

      <BarcodeScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onDetected={(code) => {
          setBarcode(code)
          setShowScanner(false)
        }}
      />
    </View>
  )
}
