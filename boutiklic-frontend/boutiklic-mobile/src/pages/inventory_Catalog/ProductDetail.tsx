import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, Minus, Pencil, Plus, Printer, Star } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { DEFAULT_LOCALE, effectiveUnitCost, formatUnitCost, isSupportedLocale } from '@boutiklic/shared'
import type { Product } from '../../types'
import { inventoryApi } from '../../lib/inventoryApi'
import { productsApi } from '../../lib/productsApi'
import { depotsApi, type DepotResponse } from '../../lib/depotsApi'
import { toErrorMessage, NetworkError } from '../../lib/apiClient'
import { syncEngine } from '../../lib/syncEngine'
import SelectField from '../../components/SelectField'
import ImageCarousel from '../../components/ImageCarousel'

interface ProductDetailProps {
  product: Product
  onBack: () => void
  formatCurrency: (n: number) => string
  /** Prix de vente UNITAIRE avec sa devise, à la précision des prix de vente de la boutique — repli : formatCurrency. */
  formatUnitPrice?: (n: number) => string
  onQuantityChanged: (productId: string, quantity: number) => void
  onFavoriteChanged: (productId: string, isFavorite: boolean) => void
  onThresholdChanged: (productId: string, alertThreshold: number) => void
  onImagesChanged: (productId: string, imageUrls: string[]) => void
  onDeleted: () => void
  /** Ouvre l'écran Étiquettes avec cet article coché — absent pour un rôle qui ne peut pas imprimer. */
  onPrintLabel?: () => void
}

export default function ProductDetail({ product, onBack, formatCurrency, formatUnitPrice = formatCurrency, onQuantityChanged, onFavoriteChanged, onThresholdChanged, onImagesChanged, onDeleted, onPrintLabel }: ProductDetailProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const [quantity, setQuantity] = useState(product.quantity)
  const [imageUrls, setImageUrls] = useState(product.imageUrls)
  const [adjusting, setAdjusting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isFavorite, setIsFavorite] = useState(product.isFavorite)
  const [togglingFavorite, setTogglingFavorite] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [editingThreshold, setEditingThreshold] = useState(false)
  const [thresholdInput, setThresholdInput] = useState(String(product.alertThreshold))
  const [savingThreshold, setSavingThreshold] = useState(false)
  // Affiché seulement si la boutique a plus d'un dépôt actif (phase 2b de l'étude
  // study/etude_multi_depots_transferts.md §2.2) — la quasi-totalité n'en ont qu'un.
  const [depots, setDepots] = useState<DepotResponse[]>([])
  const [depotId, setDepotId] = useState('')
  const hasPack = product.packSize != null && product.packPurchasePrice != null
  /** Coût unitaire EXACT : le bénéfice part de lui (333,333333), pas du prix d'achat arrondi (333). */
  const unitCost = effectiveUnitCost(product)
  const profit = product.salePrice - unitCost
  const profitMargin = ((profit / product.salePrice) * 100).toFixed(1)

  useEffect(() => {
    depotsApi.getAll().then((d) => {
      const activeDepots = d.filter((depot) => depot.active)
      setDepots(activeDepots)
      setDepotId(activeDepots.find((depot) => depot.isDefault)?.id ?? activeDepots[0]?.id ?? '')
    }).catch(() => undefined)
  }, [])

  const toggleFavorite = async () => {
    if (togglingFavorite) return
    setTogglingFavorite(true)
    setError(null)
    try {
      const next = !isFavorite
      await productsApi.setFavorite(product.id, next)
      setIsFavorite(next)
      onFavoriteChanged(product.id, next)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setTogglingFavorite(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)
    try {
      await productsApi.deactivate(product.id)
      onDeleted()
    } catch (e) {
      setError(toErrorMessage(e))
      setDeleting(false)
    }
  }

  const applyDelta = async (delta: number) => {
    if (adjusting || quantity + delta < 0) return
    setAdjusting(true)
    setError(null)
    try {
      try {
        const stockLine = await inventoryApi.adjust(product.id, delta, t('inventoryCatalog.manualAdjustmentReason'), depotId || undefined)
        setQuantity(stockLine.quantity)
        onQuantityChanged(product.id, stockLine.quantity)
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts). Écriture optimiste ici (contrairement
        // à CREATE_PRODUCT) car le delta est déjà connu et l'utilisateur attend un retour immédiat
        // sur les boutons +/- — reste une estimation tant que non synchronisé, cf. plan offline-first.
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('ADJUST_STOCK', JSON.stringify({ productId: product.id, delta, reason: t('inventoryCatalog.manualAdjustmentReason'), depotId: depotId || undefined, occurredAt: new Date().toISOString() }))
        const next = quantity + delta
        setQuantity(next)
        onQuantityChanged(product.id, next)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setAdjusting(false)
    }
  }

  /** Ajout/suppression d'image : enregistrement immédiat, comme le favori ou le stock juste au-dessus
   *  (cf. plan images multiples §5, décision "enregistrement immédiat"). */
  const handleImagesChange = async (next: string[]) => {
    setError(null)
    const payload = {
      name: product.name,
      barcode: product.barcode || undefined,
      categoryId: product.categoryId || undefined,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      currency: product.currency,
      imageUrls: next,
      // Une mise à jour REMPLACE aussi la catégorie fiscale côté serveur : on renvoie TOUJOURS celle de l'article, sinon ajouter une
      // photo le remettrait silencieusement sur « automatique » (le taux par défaut de la boutique, peut-être différent).
      taxCategoryId: product.taxCategoryId || undefined,
      // Une mise à jour REMPLACE le conditionnement côté serveur : on renvoie toujours le lot existant, sinon
      // ajouter une photo effacerait silencieusement le lot de l'article.
      ...(hasPack ? { packSize: product.packSize, packPurchasePrice: product.packPurchasePrice } : {}),
    }
    try {
      await productsApi.update(product.id, payload)
    } catch (e) {
      if (!(e instanceof NetworkError)) {
        setError(toErrorMessage(e))
        return
      }
      await syncEngine.enqueue('UPDATE_PRODUCT', JSON.stringify({ productId: product.id, ...payload }))
    }
    setImageUrls(next)
    onImagesChanged(product.id, next)
  }

  const cancelThresholdEdit = () => {
    setThresholdInput(String(product.alertThreshold))
    setEditingThreshold(false)
  }

  const saveThreshold = async () => {
    const next = Number(thresholdInput)
    if (savingThreshold || !Number.isInteger(next) || next < 0) return
    setSavingThreshold(true)
    setError(null)
    try {
      try {
        const stockLine = await inventoryApi.changeThreshold(product.id, next, depotId || undefined)
        onThresholdChanged(product.id, stockLine.alertThreshold)
        setThresholdInput(String(stockLine.alertThreshold))
        setEditingThreshold(false)
      } catch (e) {
        // Coupure réseau seulement (pas une erreur métier, cf. apiClient) : mis en file pour être
        // rejoué au retour du réseau (cf. lib/syncEngine.ts), avec écriture optimiste (cf. applyDelta).
        if (!(e instanceof NetworkError)) throw e
        await syncEngine.enqueue('CHANGE_ALERT_THRESHOLD', JSON.stringify({ productId: product.id, alertThreshold: next, depotId: depotId || undefined }))
        onThresholdChanged(product.id, next)
        setThresholdInput(String(next))
        setEditingThreshold(false)
      }
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setSavingThreshold(false)
    }
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-4">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <Text className="flex-1 text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.productSheetTitle')}</Text>
        {onPrintLabel && (
          <Pressable onPress={onPrintLabel} accessibilityLabel={t('labels.entry.fromProduct')} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
            <Printer size={18} color="#676E7E" />
          </Pressable>
        )}
        <Pressable onPress={toggleFavorite} disabled={togglingFavorite} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center disabled:opacity-50">
          <Star size={18} color={isFavorite ? '#E69D3B' : '#A2A9B8'} fill={isFavorite ? '#E69D3B' : 'transparent'} />
        </Pressable>
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        <View className="mb-4">
          <ImageCarousel imageUrls={imageUrls} onChange={handleImagesChange} height={160} />
        </View>

        <View className="mb-4">
          <Text className="text-xl font-extrabold">{product.name}</Text>
          <View className="flex-row items-center gap-2 mt-1.5">
            <View className="px-2.5 py-1 bg-bg-elevated rounded-full">
              <Text className="text-xs font-semibold text-text-muted">{product.category}</Text>
            </View>
            {quantity === 0 ? (
              <View className="px-2.5 py-1 bg-[#FBE9E4] rounded-full">
                <Text className="text-danger text-xs font-extrabold">{t('inventoryCatalog.outOfStockBadge')}</Text>
              </View>
            ) : quantity <= product.alertThreshold ? (
              <View className="px-2.5 py-1 bg-alerte-bg rounded-full">
                <Text className="text-alerte-text text-xs font-extrabold">{t('inventoryCatalog.stockAlertBadge')}</Text>
              </View>
            ) : (
              <View className="px-2.5 py-1 bg-succes-bg rounded-full">
                <Text className="text-succes-text text-xs font-extrabold">{t('inventoryCatalog.okBadge')}</Text>
              </View>
            )}
          </View>
        </View>

        <View className="flex-row gap-3 mb-4">
          <View className="flex-1 bg-bg-card rounded-2xl border border-border p-3.5">
            <Text className="text-text-dim text-xs font-semibold">{t('inventoryCatalog.salePriceLabel')}</Text>
            <Text className="amount text-lg font-extrabold mt-0.5">{formatUnitPrice(product.salePrice)}</Text>
          </View>
          <View className="flex-1 bg-bg-card rounded-2xl border border-border p-3.5">
            <Text className="text-text-dim text-xs font-semibold">{t('inventoryCatalog.purchasePriceLabel')}</Text>
            <Text className="amount text-lg font-extrabold mt-0.5">
              {hasPack ? `${formatUnitCost(unitCost, locale)} ${product.currency}` : formatCurrency(product.purchasePrice)}
            </Text>
            {hasPack && (
              <Text className="text-text-dim text-xs font-semibold">{t('inventoryCatalog.packLineSummary', { count: 1, units: product.packSize })} = {formatCurrency(product.packPurchasePrice as number)}</Text>
            )}
          </View>
        </View>

        <View className="bg-succes-bg rounded-2xl border border-[#CBE1D7] p-3.5 mb-4">
          <View className="flex-row justify-between items-center">
            <Text className="text-succes-text text-sm font-bold">{t('inventoryCatalog.estimatedProfitLabel')}</Text>
            <Text className="text-succes-text font-extrabold">{profitMargin}%</Text>
          </View>
          <Text className="amount text-succes-text text-lg font-extrabold mt-1">{formatCurrency(profit)} {t('inventoryCatalog.perUnitSuffix')}</Text>
        </View>

        <View className="bg-bg-card rounded-2xl border border-border p-4 mb-4">
          <Text className="text-text-dim text-xs font-semibold mb-3">{t('inventoryCatalog.stockManagementLabel')}</Text>
          {depots.length > 1 && (
            <View className="mb-3">
              <SelectField
                value={depotId}
                onChange={setDepotId}
                options={depots.map((d) => ({ label: d.isDefault ? `${d.name} (${t('settings.defaultDepotBadge')})` : d.name, value: d.id }))}
              />
            </View>
          )}
          <View className="flex-row items-center justify-between">
            <Pressable onPress={() => applyDelta(-1)} disabled={adjusting || quantity === 0} className="w-10 h-10 rounded-xl bg-bg-elevated items-center justify-center active:scale-95 disabled:opacity-40">
              <Minus size={18} color="#111418" />
            </Pressable>
            <View className="items-center">
              <Text className="amount text-2xl font-extrabold">{quantity}</Text>
              <Text className="text-xs text-text-dim font-semibold">{t('inventoryCatalog.unitsSuffix')}</Text>
            </View>
            <Pressable onPress={() => applyDelta(1)} disabled={adjusting} className="w-10 h-10 rounded-xl bg-primary items-center justify-center active:scale-95 disabled:opacity-40">
              <Plus size={18} color="#FFFDFA" />
            </Pressable>
          </View>
          <View className="mt-3.5">
            <View className="flex-row justify-between items-center mb-1.5">
              {editingThreshold ? (
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs font-semibold text-text-dim">{t('inventoryCatalog.alertThresholdLabel')}</Text>
                  <TextInput
                    keyboardType="number-pad"
                    autoFocus
                    value={thresholdInput}
                    onChangeText={setThresholdInput}
                    className="w-14 h-7 rounded-lg border border-border-strong bg-bg-card px-2 text-xs font-bold"
                  />
                  <Pressable onPress={saveThreshold} disabled={savingThreshold} className="px-2 py-1 rounded-lg bg-primary disabled:opacity-50">
                    <Text className="text-papier text-[11px] font-extrabold">{t('inventoryCatalog.okBadge')}</Text>
                  </Pressable>
                  <Pressable onPress={cancelThresholdEdit} disabled={savingThreshold}>
                    <Text className="text-[11px] font-bold text-text-dim">{t('inventoryCatalog.cancel')}</Text>
                  </Pressable>
                </View>
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <Text className="text-xs font-semibold text-text-dim">{t('inventoryCatalog.alertThresholdDisplay', { threshold: product.alertThreshold })}</Text>
                  <Pressable onPress={() => setEditingThreshold(true)}>
                    <Pencil size={12} color="#A2A9B8" />
                  </Pressable>
                </View>
              )}
              <Text className="text-xs font-semibold text-text-dim">{Math.round((quantity / (product.alertThreshold * 3)) * 100)}%</Text>
            </View>
            <View className="h-2 bg-bg-elevated rounded-full overflow-hidden">
              <View
                className={`h-full rounded-full ${quantity === 0 ? 'bg-danger' : quantity <= product.alertThreshold ? 'bg-warning' : 'bg-success'}`}
                style={{ width: `${Math.min(100, (quantity / (product.alertThreshold * 3)) * 100)}%` }}
              />
            </View>
          </View>
          {error && <Text className="text-[13px] font-semibold text-danger mt-3">{error}</Text>}
        </View>

        {product.barcode && (
          <View className="bg-bg-card rounded-2xl border border-border p-3.5 mb-4">
            <Text className="text-text-dim text-xs font-semibold mb-1">{t('inventoryCatalog.barcodeLabel')}</Text>
            <Text className="amount text-sm font-bold">{product.barcode}</Text>
          </View>
        )}

        {confirmDelete ? (
          <View className="flex-row gap-2.5">
            <Pressable onPress={() => setConfirmDelete(false)} className="flex-1 bg-bg-card border border-border-strong py-3.5 rounded-2xl items-center active:scale-95">
              <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
            </Pressable>
            <Pressable onPress={handleDelete} disabled={deleting} className="flex-1 bg-danger py-3.5 rounded-2xl items-center active:scale-95 disabled:opacity-50">
              <Text className="text-papier font-extrabold">{deleting ? t('inventoryCatalog.deleting') : t('inventoryCatalog.confirm')}</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={() => setConfirmDelete(true)} className="w-full bg-bg-card border border-border-strong py-3.5 rounded-2xl items-center active:scale-95">
            <Text className="text-danger font-bold">{t('inventoryCatalog.deleteArticle')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  )
}
