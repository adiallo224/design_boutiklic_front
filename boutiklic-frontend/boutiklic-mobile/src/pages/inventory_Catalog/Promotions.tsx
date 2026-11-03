import { useEffect, useState } from 'react'
import { View, Text, Pressable, TextInput, ScrollView, Alert } from 'react-native'
import { ChevronLeft, Plus, X, Tag, Pencil, Trash2, Check, Printer } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { isSupportedLocale, DEFAULT_LOCALE, formatNumber, promotedProductIds, type LabelPreselection } from '@boutiklic/shared'
import type { Product } from '../../types'
import { promotionsApi, type PromotionResponse, type PromotionType } from '../../lib/promotionsApi'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { useTenant } from '../../hooks/useTenant'
import { toErrorMessage } from '../../lib/apiClient'
import DateField from '../../components/DateField'
import { formatDate } from '../../lib/dateFormat'

interface PromotionsProps {
  onBack: () => void
  products: Product[]
  /** Créer/modifier/supprimer une promotion est réservé au propriétaire, cf. PromotionController. */
  isOwner: boolean
  /** Impression d'étiquettes promo : propriétaire et vendeurs, comme la modification d'article. */
  canPrintLabels: boolean
  /** Ouvre l'écran Étiquettes avec les articles visés par la promotion cochés. */
  onPrintLabels: (items: LabelPreselection[]) => void
}

/** Convertit une date locale ('YYYY-MM-DD') en Instant ISO correct — ne JAMAIS suffixer "Z"
 *  directement sur la date locale, ça décale le début/fin de journée selon le fuseau. */
function toInstant(dateStr: string, endOfDay: boolean): string {
  return new Date(`${dateStr}T${endOfDay ? '23:59:59' : '00:00:00'}`).toISOString()
}

/** Inverse de toInstant — pour pré-remplir le formulaire d'édition avec la date locale affichée. */
function toDateInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export default function Promotions({ onBack, products, isOwner, canPrintLabels, onPrintLabels }: PromotionsProps) {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const { tenant } = useTenant()
  const [promotions, setPromotions] = useState<PromotionResponse[]>([])
  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [type, setType] = useState<PromotionType>('PERCENTAGE')
  const [value, setValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [scope, setScope] = useState<'PRODUCTS' | 'CATEGORIES'>('PRODUCTS')
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const load = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [promos, cats] = await Promise.all([promotionsApi.getAll(), categoriesApi.getAll()])
      setPromotions(promos)
      setCategories(cats)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? '…'
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? '…'

  const resetForm = () => {
    setEditingId(null)
    setName('')
    setType('PERCENTAGE')
    setValue('')
    setStartDate('')
    setEndDate('')
    setSelectedProductIds([])
    setSelectedCategoryIds([])
    setFormError(null)
  }

  const startEdit = (promo: PromotionResponse) => {
    setEditingId(promo.id)
    setName(promo.name)
    setType(promo.type)
    setValue(String(promo.value))
    setStartDate(toDateInputValue(promo.startDate))
    setEndDate(toDateInputValue(promo.endDate))
    setSelectedProductIds(promo.productIds)
    setSelectedCategoryIds(promo.categoryIds)
    setScope(promo.productIds.length > 0 ? 'PRODUCTS' : 'CATEGORIES')
    setFormError(null)
    setShowAdd(true)
  }

  const toggleProduct = (id: string) => setSelectedProductIds((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))
  const toggleCategory = (id: string) => setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]))

  const handleSubmit = async () => {
    const parsedValue = parseFloat(value.replace(',', '.'))
    if (name.trim().length === 0 || !parsedValue || parsedValue <= 0 || !startDate || !endDate) return
    if (selectedProductIds.length === 0 && selectedCategoryIds.length === 0) {
      setFormError(t('inventoryCatalog.chooseProductOrCategory'))
      return
    }
    setCreating(true)
    setFormError(null)
    const payload = {
      name: name.trim(),
      type,
      value: parsedValue,
      currency: tenant.currency,
      startDate: toInstant(startDate, false),
      endDate: toInstant(endDate, true),
      productIds: selectedProductIds,
      categoryIds: selectedCategoryIds,
    }
    try {
      if (editingId) {
        await promotionsApi.update(editingId, payload)
      } else {
        await promotionsApi.create(payload)
      }
      resetForm()
      setShowAdd(false)
      await load()
    } catch (e) {
      setFormError(toErrorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const handleToggleActive = async (promotion: PromotionResponse) => {
    setError(null)
    try {
      await promotionsApi.setActive(promotion.id, !promotion.active)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }

  const doDelete = async (promotion: PromotionResponse) => {
    setDeletingId(promotion.id)
    setError(null)
    try {
      await promotionsApi.remove(promotion.id)
      await load()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDelete = (promotion: PromotionResponse) => {
    Alert.alert(t('inventoryCatalog.deletePromotionTitle'), t('inventoryCatalog.confirmDeletePromotion', { name: promotion.name }), [
      { text: t('inventoryCatalog.cancel'), style: 'cancel' },
      { text: t('inventoryCatalog.deleteAriaLabel'), style: 'destructive', onPress: () => doDelete(promotion) },
    ])
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.promotionsTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.promotionsSubtitle')}</Text>
        </View>
        {isOwner && (
          <Pressable
            onPress={() => {
              resetForm()
              setShowAdd(true)
            }}
            className="w-10 h-10 rounded-xl bg-primary items-center justify-center active:scale-95"
          >
            <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}
        {isLoading ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('common.loading')}</Text>
        ) : promotions.length === 0 && !showAdd ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('inventoryCatalog.noPromotionsYet')}</Text>
        ) : (
          promotions.map((promo) => {
            const targets = [...promo.productIds.map(productName), ...promo.categoryIds.map(categoryName)]
            // Étiquettes seulement pour une promotion EN COURS : la page Étiquettes n'applique que les promotions actives
            // (même règle que la caisse) — pour une promo en pause ou à venir, l'étiquette n'aurait pas de prix promo.
            const now = Date.now()
            const isRunning = promo.active && Date.parse(promo.startDate) <= now && now <= Date.parse(promo.endDate)
            const targetedIds = canPrintLabels && isRunning ? promotedProductIds([promo], products.filter((p) => p.isActive)) : []
            return (
              <View key={promo.id} className="p-[15px] rounded-[17px] bg-bg-card border border-border gap-2.5">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-base font-bold" numberOfLines={1}>
                      {promo.name}
                    </Text>
                    <Text className="text-[13px] text-text-dim">
                      {formatDate(promo.startDate)} → {formatDate(promo.endDate)}
                    </Text>
                  </View>
                  <View className="px-2.5 py-1 rounded-[9px] bg-info-bg">
                    <Text className="text-info-text text-xs font-extrabold">{promo.type === 'PERCENTAGE' ? `-${promo.value}%` : `-${formatNumber(promo.value, locale)} ${promo.currency}`}</Text>
                  </View>
                </View>
                <Text className="text-[13px] text-text-muted" numberOfLines={1}>
                  {targets.join(', ')}
                </Text>
                {targetedIds.length > 0 && (
                  <Pressable
                    onPress={() => onPrintLabels(targetedIds.map((productId) => ({ productId, copies: 1 })))}
                    className="self-start h-9 px-3.5 rounded-xl border border-border-strong bg-bg-card flex-row items-center gap-1.5"
                  >
                    <Printer size={14} color="#111418" />
                    <Text className="text-[13px] font-bold">{t('labels.promo.printForPromo')} ({targetedIds.length})</Text>
                  </Pressable>
                )}
                {isOwner && (
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Pressable onPress={() => handleToggleActive(promo)} className={`px-3 py-1.5 rounded-[9px] ${promo.active ? 'bg-succes-bg' : 'bg-bg-elevated'}`}>
                      <Text className={`text-xs font-bold ${promo.active ? 'text-succes-text' : 'text-text-dim'}`}>{promo.active ? t('inventoryCatalog.activePause') : t('inventoryCatalog.pausedReactivate')}</Text>
                    </Pressable>
                    <Pressable onPress={() => startEdit(promo)} className="w-8 h-8 rounded-[9px] border border-border-strong items-center justify-center">
                      <Pencil size={14} color="#676E7E" />
                    </Pressable>
                    <Pressable onPress={() => handleDelete(promo)} disabled={deletingId === promo.id} className="w-8 h-8 rounded-[9px] border border-[#F0C9C2] items-center justify-center disabled:opacity-50">
                      <Trash2 size={14} color="#C6362F" />
                    </Pressable>
                  </View>
                )}
              </View>
            )
          })
        )}

        {showAdd && (
          <View className="p-4 rounded-[17px] bg-bg-card border border-border gap-3">
            <View className="flex-row items-center justify-between">
              <Text className="text-sm font-extrabold">{editingId ? t('inventoryCatalog.editPromotionTitle') : t('inventoryCatalog.newPromotionTitle')}</Text>
              <Pressable
                onPress={() => {
                  setShowAdd(false)
                  resetForm()
                }}
              >
                <X size={16} color="#A2A9B8" />
              </Pressable>
            </View>
            <TextInput value={name} onChangeText={setName} placeholder={t('inventoryCatalog.promotionNamePlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
            <View className="flex-row gap-2">
              {(['PERCENTAGE', 'AMOUNT'] as PromotionType[]).map((typeOption) => (
                <Pressable key={typeOption} onPress={() => setType(typeOption)} className={`flex-1 py-2.5 rounded-xl items-center ${type === typeOption ? 'bg-primary' : 'border border-border-strong'}`}>
                  <Text className={`text-sm font-bold ${type === typeOption ? 'text-papier' : 'text-text-muted'}`}>{typeOption === 'PERCENTAGE' ? '%' : tenant.currency}</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={value}
              onChangeText={(v) => setValue(v.replace(/[^0-9.,]/g, ''))}
              placeholder={type === 'PERCENTAGE' ? t('inventoryCatalog.percentageExample') : t('inventoryCatalog.amountExample')}
              keyboardType="decimal-pad"
              className="amount h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-bold"
            />
            <View className="flex-row gap-2">
              <DateField value={startDate} onChange={setStartDate} placeholder={t('inventoryCatalog.startDatePlaceholder')} className="flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-3 justify-center" />
              <DateField value={endDate} onChange={setEndDate} placeholder={t('inventoryCatalog.endDatePlaceholder')} className="flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-3 justify-center" />
            </View>

            <View className="flex-row gap-2">
              <Pressable onPress={() => setScope('PRODUCTS')} className={`flex-1 py-2 rounded-xl items-center ${scope === 'PRODUCTS' ? 'bg-primary' : 'border border-border-strong'}`}>
                <Text className={`text-sm font-bold ${scope === 'PRODUCTS' ? 'text-papier' : 'text-text-muted'}`}>{t('inventoryCatalog.productsScope')}{selectedProductIds.length > 0 ? ` (${selectedProductIds.length})` : ''}</Text>
              </Pressable>
              <Pressable onPress={() => setScope('CATEGORIES')} className={`flex-1 py-2 rounded-xl items-center ${scope === 'CATEGORIES' ? 'bg-primary' : 'border border-border-strong'}`}>
                <Text className={`text-sm font-bold ${scope === 'CATEGORIES' ? 'text-papier' : 'text-text-muted'}`}>{t('inventoryCatalog.categoriesScope')}{selectedCategoryIds.length > 0 ? ` (${selectedCategoryIds.length})` : ''}</Text>
              </Pressable>
            </View>

            <View className="max-h-[180px] border border-border-hairline rounded-xl p-2">
              <ScrollView showsVerticalScrollIndicator={false}>
                {(scope === 'PRODUCTS' ? products : categories).length === 0 && <Text className="text-[13px] text-text-dim px-2 py-1.5">{t('inventoryCatalog.noResults')}</Text>}
                {scope === 'PRODUCTS'
                  ? products.map((p) => {
                      const checked = selectedProductIds.includes(p.id)
                      return (
                        <Pressable key={p.id} onPress={() => toggleProduct(p.id)} className="flex-row items-center gap-2.5 px-2 py-1.5 rounded-lg">
                          <View className={`w-5 h-5 rounded-md items-center justify-center ${checked ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
                            {checked && <Check size={12} strokeWidth={3.4} color="#FFFDFA" />}
                          </View>
                          <Text className="text-sm font-semibold" numberOfLines={1}>
                            {p.name}
                          </Text>
                        </Pressable>
                      )
                    })
                  : categories.map((c) => {
                      const checked = selectedCategoryIds.includes(c.id)
                      return (
                        <Pressable key={c.id} onPress={() => toggleCategory(c.id)} className="flex-row items-center gap-2.5 px-2 py-1.5 rounded-lg">
                          <View className={`w-5 h-5 rounded-md items-center justify-center ${checked ? 'bg-primary' : 'border-2 border-[#DDD2C3]'}`}>
                            {checked && <Check size={12} strokeWidth={3.4} color="#FFFDFA" />}
                          </View>
                          <Text className="text-sm font-semibold" numberOfLines={1}>
                            {c.name}
                          </Text>
                        </Pressable>
                      )
                    })}
              </ScrollView>
            </View>

            {formError && <Text className="text-[13px] font-semibold text-danger">{formError}</Text>}

            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  setShowAdd(false)
                  resetForm()
                }}
                className="flex-1 py-2.5 rounded-xl border border-border-strong items-center"
              >
                <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleSubmit} disabled={creating || name.trim().length === 0 || !value || !startDate || !endDate} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{creating ? t('inventoryCatalog.saving') : editingId ? t('inventoryCatalog.save') : t('inventoryCatalog.create')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="mt-2 p-4 rounded-2xl bg-info-bg border border-info-border flex-row gap-3">
          <Tag size={20} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-relaxed text-[#33465E]">
            {t('inventoryCatalog.promotionHint')}
          </Text>
        </View>
      </ScrollView>
    </View>
  )
}
