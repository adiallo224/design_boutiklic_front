import { useEffect, useState } from 'react'
import { View, Text, Pressable, Image, ScrollView, TextInput } from 'react-native'
import { ChevronLeft, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { categoryIconEmoji } from '@boutiklic/shared'
import type { Product } from '../../types'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { descendantAndSelfIds } from '../../lib/categoryTree'
import { productsApi } from '../../lib/productsApi'
import { taxApi, type TaxCategoryResponse } from '../../lib/taxApi'
import { formatTaxRate, inheritedTax } from '../../lib/taxInheritance'
import { toErrorMessage } from '../../lib/apiClient'
import { useTenant } from '../../hooks/useTenant'
import { ColorPicker, IconPicker } from './Categories'

interface CategoryDetailProps {
  category: CategoryResponse
  categories: CategoryResponse[]
  products: Product[]
  /** Ajouter un article et modifier/supprimer la catégorie sont réservés au propriétaire, cf. CategoryController et ProductController. */
  isOwner: boolean
  onBack: () => void
  onAdd: () => void
  onProductDeleted: () => void
  /** Après un renommage, un changement de couleur ou d'icône : recharge le catalogue (la fiche reçoit alors la catégorie à jour). */
  onCategoriesChanged: () => void | Promise<void>
  /** La catégorie a été supprimée côté serveur : l'écran appelant revient à la liste. */
  onDeleted: () => void
}

export default function CategoryDetail({ category, categories, products, isOwner, onBack, onAdd, onProductDeleted, onCategoriesChanged, onDeleted }: CategoryDetailProps) {
  const { t } = useTranslation()
  const { formatUnitPrice, tenant } = useTenant()
  const [taxCategories, setTaxCategories] = useState<TaxCategoryResponse[]>([])
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(category.name)
  const [saving, setSaving] = useState(false)
  const [confirmingCategoryDelete, setConfirmingCategoryDelete] = useState(false)

  useEffect(() => setName(category.name), [category.name])
  useEffect(() => {
    taxApi.getActiveCategories().then(setTaxCategories).catch(() => undefined)
  }, [])

  // Ce que la catégorie hérite tant qu'elle n'a pas de TVA propre : son parent (le plus proche qui en porte une), sinon la boutique.
  const inherited = inheritedTax(category.parentId, categories, taxCategories, tenant.defaultTaxCategoryId, tenant.taxEnabled)
  const inheritedLabel = inherited.taxCategory
    ? t(inherited.source === 'category' ? 'inventoryCatalog.taxInheritedFromCategory' : 'inventoryCatalog.taxInheritedFromShop', { rate: formatTaxRate(inherited.taxCategory.ratePercent) })
    : t('inventoryCatalog.taxNone')

  /** null = retirer la TVA propre (la catégorie hérite alors de son parent, puis de la boutique). */
  const changeTax = async (taxCategoryId: string | null) => {
    setSaving(true)
    setError(null)
    try {
      await categoriesApi.changeTaxCategory(category.id, taxCategoryId)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      await onCategoriesChanged()
      setSaving(false)
    }
  }

  const includedIds = descendantAndSelfIds(category.id, categories)
  const articles = products.filter((p) => p.categoryId && includedIds.has(p.categoryId))
  /** Seuls les articles DIRECTS de la catégorie repassent « Non classés » ; les sous-catégories remontent avec les leurs. */
  const directArticleCount = products.filter((p) => p.categoryId === category.id).length
  const childCount = categories.filter((c) => c.parentId === category.id).length

  const handleDelete = async (productId: string) => {
    setDeletingId(productId)
    setError(null)
    try {
      await productsApi.deactivate(productId)
      setConfirmDeleteId(null)
      onProductDeleted()
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setDeletingId(null)
    }
  }

  /** Remplacement complet côté API : on renvoie toujours le parent actuel, seul le champ modifié change. */
  const save = async (patch: Partial<Pick<CategoryResponse, 'name' | 'color' | 'icon'>>) => {
    setSaving(true)
    setError(null)
    try {
      const next = { ...category, ...patch }
      await categoriesApi.update(category.id, { name: next.name, color: next.color, icon: next.icon ?? undefined, parentId: category.parentId })
      await onCategoriesChanged()
    } catch (e) {
      setError(toErrorMessage(e))
      setName(category.name)
      await onCategoriesChanged()
    } finally {
      setSaving(false)
    }
  }

  const saveName = () => {
    const next = name.trim()
    if (next.length === 0) {
      setName(category.name)
      return
    }
    if (next !== category.name) save({ name: next })
  }

  const handleDeleteCategory = async () => {
    setSaving(true)
    setError(null)
    try {
      await categoriesApi.remove(category.id)
      onDeleted()
      await onCategoriesChanged()
    } catch (e) {
      setError(toErrorMessage(e))
      setConfirmingCategoryDelete(false)
    } finally {
      setSaving(false)
    }
  }

  const subtitle =
    category.depth === 1
      ? childCount > 0
        ? t('inventoryCatalog.categoriesScreen.subcategoriesCount', { count: childCount })
        : t('inventoryCatalog.categoriesScreen.mainCategory')
      : t('inventoryCatalog.categoriesScreen.subcategory')

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="w-[42px] h-[42px] rounded-2xl items-center justify-center" style={{ backgroundColor: category.color }}>
          <Text className="text-lg">{categoryIconEmoji(category.icon)}</Text>
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight" numberOfLines={1}>
            {category.name}
          </Text>
          <Text className="text-[13px] font-semibold text-text-dim">
            {subtitle} · {t('inventoryCatalog.articleCount', { count: articles.length })}
          </Text>
        </View>
        {isOwner && (
          <Pressable
            onPress={() => setEditing((v) => !v)}
            accessibilityLabel={t('inventoryCatalog.categoriesScreen.edit')}
            className={`w-10 h-10 rounded-xl border items-center justify-center ${editing ? 'bg-info-bg border-primary' : 'bg-bg-card border-border-strong'}`}
          >
            <Pencil size={18} color="#111418" />
          </Pressable>
        )}
        {isOwner && (
          <Pressable onPress={onAdd} className="w-10 h-10 rounded-xl bg-primary items-center justify-center">
            <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      {error && <Text className="px-5 pb-3 text-[13px] font-semibold text-danger">{error}</Text>}

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {isOwner && editing && (
          <View className="p-4 rounded-[17px] bg-bg-card border border-border gap-3.5">
            <View className="gap-1.5">
              <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">{t('inventoryCatalog.categoriesScreen.name')}</Text>
              <View className="flex-row gap-2">
                <TextInput
                  value={name}
                  onChangeText={setName}
                  onSubmitEditing={saveName}
                  maxLength={100}
                  placeholder={t('inventoryCatalog.categoryNamePlaceholder')}
                  className="flex-1 h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold"
                />
                <Pressable
                  onPress={saveName}
                  disabled={saving || name.trim().length === 0 || name.trim() === category.name}
                  className="px-4 rounded-xl bg-primary items-center justify-center disabled:opacity-40"
                >
                  <Text className="text-papier font-extrabold">{t('inventoryCatalog.categoriesScreen.save')}</Text>
                </Pressable>
              </View>
            </View>

            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">{t('inventoryCatalog.categoriesScreen.color')}</Text>
              <ColorPicker value={category.color} onChange={(color) => save({ color })} disabled={saving} />
            </View>

            <View className="gap-2">
              <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">{t('inventoryCatalog.categoriesScreen.icon')}</Text>
              <IconPicker value={category.icon} onChange={(icon) => save({ icon })} disabled={saving} />
            </View>

            {taxCategories.length > 0 && (
              <View className="gap-2">
                <Text className="text-xs font-bold uppercase tracking-widest text-text-muted">{t('inventoryCatalog.categoriesScreen.taxLabel')}</Text>
                {[{ id: '', label: inheritedLabel }, ...taxCategories.map((c) => ({ id: c.id, label: t('inventoryCatalog.taxRateOption', { name: c.name, rate: formatTaxRate(c.ratePercent) }) }))].map((option) => {
                  const selected = (category.taxCategoryId ?? '') === option.id
                  return (
                    <Pressable
                      key={option.id || 'inherited'}
                      onPress={() => !selected && changeTax(option.id || null)}
                      disabled={saving}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected, disabled: saving }}
                      className={`px-4 py-3 rounded-xl border ${selected ? 'border-primary bg-bg' : 'border-border-strong bg-bg'}`}
                    >
                      <Text className={`text-[14px] ${selected ? 'font-extrabold' : 'font-semibold'}`}>{option.label}</Text>
                    </Pressable>
                  )
                })}
                <Text className="text-[11px] leading-snug text-text-muted">
                  {tenant.taxEnabled ? t('inventoryCatalog.categoriesScreen.taxHelp') : t('inventoryCatalog.categoriesScreen.taxDisabledHelp')}
                </Text>
              </View>
            )}

            {confirmingCategoryDelete ? (
              <View className="p-3.5 rounded-2xl bg-danger/10 gap-3">
                <View className="flex-row items-center gap-2">
                  <TriangleAlert size={18} color="#C0392B" />
                  <Text className="flex-1 text-[15px] font-extrabold">{t('inventoryCatalog.categoriesScreen.deleteTitle', { name: category.name })}</Text>
                </View>
                <Text className="text-[13px] leading-relaxed text-text-secondary">
                  {directArticleCount > 0 ? `${t('inventoryCatalog.categoriesScreen.deleteProducts', { count: directArticleCount })} ` : ''}
                  {childCount > 0 ? `${t('inventoryCatalog.categoriesScreen.deleteChildren', { count: childCount })} ` : ''}
                  {t('inventoryCatalog.categoriesScreen.deleteIrreversible')}
                </Text>
                <View className="flex-row gap-2">
                  <Pressable onPress={() => setConfirmingCategoryDelete(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                    <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
                  </Pressable>
                  <Pressable onPress={handleDeleteCategory} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-danger items-center disabled:opacity-50">
                    <Text className="text-papier font-extrabold">{saving ? '...' : t('inventoryCatalog.confirm')}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable onPress={() => setConfirmingCategoryDelete(true)} className="flex-row items-center justify-center gap-2 py-3 rounded-xl border border-border bg-bg-card active:scale-[0.98]">
                <Trash2 size={16} color="#C0392B" />
                <Text className="text-danger font-extrabold">{t('inventoryCatalog.categoriesScreen.delete')}</Text>
              </Pressable>
            )}
          </View>
        )}

        {articles.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim text-center py-8">{t('inventoryCatalog.noArticlesInCategory')}</Text>
        ) : (
          articles.map((article) => {
            const isConfirming = confirmDeleteId === article.id
            return (
              <View key={article.id} className="flex-row items-center gap-3.5 p-[15px] rounded-[17px] bg-bg-card border border-border">
                <View className="w-[46px] h-[46px] rounded-2xl bg-bg-elevated items-center justify-center overflow-hidden">
                  {article.imageUrl ? <Image source={{ uri: article.imageUrl }} className="w-full h-full" /> : <Text className="text-xl">📦</Text>}
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-base font-bold" numberOfLines={1}>
                    {article.name}
                  </Text>
                  <Text className="amount text-[13px] text-text-dim">
                    {formatUnitPrice(article.salePrice)} · {t('inventoryCatalog.stockLabel', { count: article.quantity })}
                  </Text>
                </View>
                {isConfirming ? (
                  <View className="flex-row items-center gap-1.5">
                    <Pressable onPress={() => handleDelete(article.id)} disabled={deletingId === article.id} className="px-3 py-2 rounded-[11px] bg-danger active:scale-95 disabled:opacity-50">
                      <Text className="text-papier text-[13px] font-extrabold">{deletingId === article.id ? '...' : t('inventoryCatalog.confirm')}</Text>
                    </Pressable>
                    <Pressable onPress={() => setConfirmDeleteId(null)} className="px-3 py-2 rounded-[11px] bg-bg-elevated active:scale-95">
                      <Text className="text-encre text-[13px] font-extrabold">{t('inventoryCatalog.cancel')}</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Pressable onPress={() => setConfirmDeleteId(article.id)} className="w-9 h-9 rounded-[11px] bg-bg-elevated items-center justify-center active:scale-95">
                    <Trash2 size={16} color="#A2A9B8" />
                  </Pressable>
                )}
              </View>
            )
          })
        )}
      </ScrollView>
    </View>
  )
}
