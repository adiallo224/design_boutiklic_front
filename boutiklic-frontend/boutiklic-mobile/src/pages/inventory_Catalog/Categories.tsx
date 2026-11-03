import { useState, type ReactNode } from 'react'
import { View, Text, Pressable, TextInput, ScrollView } from 'react-native'
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Inbox, Plus, Info } from 'lucide-react-native'
import { useTranslation } from 'react-i18next'
import { CATEGORY_COLORS, CATEGORY_ICONS, DEFAULT_CATEGORY_ICON, categoryIconEmoji } from '@boutiklic/shared'
import type { Product } from '../../types'
import { categoriesApi, type CategoryResponse } from '../../lib/categoriesApi'
import { buildCategoryTree, descendantAndSelfIds, flattenCategoryTree, type CategoryTreeNode } from '../../lib/categoryTree'
import { toErrorMessage } from '../../lib/apiClient'

interface CategoriesProps {
  onBack: () => void
  categories: CategoryResponse[]
  products: Product[]
  /** Créer, ordonner et modifier les catégories est réservé au propriétaire, cf. CategoryController. */
  isOwner: boolean
  /** Recharge le catalogue ; la promesse permet d'attendre les données à jour avant de naviguer. */
  onCategoriesChanged: () => void | Promise<void>
  onSelectCategory: (category: CategoryResponse) => void
  onOpenUnclassified: () => void
}

const MAX_DEPTH = 3

export default function Categories({ onBack, categories, products, isOwner, onCategoriesChanged, onSelectCategory, onOpenUnclassified }: CategoriesProps) {
  const { t } = useTranslation()
  const [error, setError] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState(CATEGORY_COLORS[0])
  const [icon, setIcon] = useState(DEFAULT_CATEGORY_ICON)
  const [parentId, setParentId] = useState('')
  const [busy, setBusy] = useState(false)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const tree = buildCategoryTree(categories)
  const possibleParents = flattenCategoryTree(categories).filter((c) => c.depth < MAX_DEPTH)
  const unclassifiedCount = products.filter((p) => !p.categoryId).length

  const countFor = (categoryId: string) => {
    const ids = descendantAndSelfIds(categoryId, categories)
    return products.filter((p) => p.categoryId && ids.has(p.categoryId)).length
  }

  const toggleCollapsed = (categoryId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(categoryId)) next.delete(categoryId)
      else next.add(categoryId)
      return next
    })
  }

  /** Exécute une écriture, affiche l'erreur éventuelle et recharge le catalogue dans tous les cas. */
  const run = async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true)
    setError(null)
    try {
      const result = await action()
      await onCategoriesChanged()
      return result
    } catch (e) {
      setError(toErrorMessage(e))
      await onCategoriesChanged()
      return undefined
    } finally {
      setBusy(false)
    }
  }

  const uniqueName = (base: string) => {
    const taken = new Set(categories.map((c) => c.name.toLowerCase()))
    let candidate = base
    for (let n = 2; taken.has(candidate.toLowerCase()); n++) candidate = `${base} ${n}`
    return candidate
  }

  const handleCreate = async () => {
    if (name.trim().length === 0) return
    const created = await run(() => categoriesApi.create({ name: name.trim(), color, icon, parentId: parentId || undefined }))
    if (!created) return
    setName('')
    setParentId('')
    setShowAdd(false)
  }

  /** « + Sous-catégorie » : crée la sous-catégorie avec un nom par défaut (héritant couleur et icône du parent) et ouvre sa fiche pour la renommer. */
  const handleAddChild = async (parent: CategoryResponse) => {
    const created = await run(() =>
      categoriesApi.create({ name: uniqueName(t('inventoryCatalog.categoriesScreen.newSubcategoryDefaultName')), color: parent.color, icon: parent.icon ?? DEFAULT_CATEGORY_ICON, parentId: parent.id }),
    )
    if (created) onSelectCategory(created)
  }

  const move = (category: CategoryResponse, direction: -1 | 1) => {
    const siblings = categories
      .filter((c) => (c.parentId ?? null) === (category.parentId ?? null))
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name))
    const ids = siblings.map((c) => c.id)
    const from = ids.indexOf(category.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    run(() => categoriesApi.reorder(category.parentId ?? null, ids))
  }

  const renderNode = (node: CategoryTreeNode): ReactNode => {
    const { category } = node
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.has(category.id)
    return (
      <View key={category.id} style={{ gap: 10 }}>
        <View style={{ paddingLeft: (category.depth - 1) * 20, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {hasChildren ? (
            <Pressable onPress={() => toggleCollapsed(category.id)} className="w-6 h-6 items-center justify-center">
              <ChevronDown size={16} color="#A2A9B8" style={{ transform: [{ rotate: isCollapsed ? '-90deg' : '0deg' }] }} />
            </Pressable>
          ) : (
            <View className="w-6" />
          )}
          <Pressable onPress={() => onSelectCategory(category)} className="flex-1 flex-row items-center gap-3.5 p-[15px] rounded-[17px] bg-bg-card border border-border active:scale-[0.98]">
            <View className="w-[46px] h-[46px] rounded-2xl items-center justify-center" style={{ backgroundColor: category.color }}>
              <Text className="text-xl">{categoryIconEmoji(category.icon)}</Text>
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-base font-bold">{category.name}</Text>
              <Text className="text-[13px] text-text-dim">{t('inventoryCatalog.articleCount', { count: countFor(category.id) })}</Text>
            </View>
            <ChevronRight size={18} color="#A2A9B8" />
          </Pressable>
          {isOwner && (
            <View>
              <Pressable
                onPress={() => move(category, -1)}
                disabled={busy}
                accessibilityLabel={t('inventoryCatalog.categoriesScreen.moveUp')}
                hitSlop={6}
                className="w-7 h-7 items-center justify-center"
              >
                <ChevronUp size={18} color="#A2A9B8" />
              </Pressable>
              <Pressable
                onPress={() => move(category, 1)}
                disabled={busy}
                accessibilityLabel={t('inventoryCatalog.categoriesScreen.moveDown')}
                hitSlop={6}
                className="w-7 h-7 items-center justify-center"
              >
                <ChevronDown size={18} color="#A2A9B8" />
              </Pressable>
            </View>
          )}
        </View>
        {hasChildren && !isCollapsed && node.children.map(renderNode)}
        {isOwner && category.depth === 1 && !isCollapsed && (
          <Pressable onPress={() => handleAddChild(category)} disabled={busy} className="flex-row items-center gap-1.5 py-1 disabled:opacity-50" style={{ paddingLeft: 32 + 20 }}>
            <Plus size={14} color="#6B7280" />
            <Text className="text-xs font-bold text-text-dim">{t('inventoryCatalog.categoriesScreen.addSubcategory')}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  return (
    <View className="flex-1 bg-bg">
      <View className="flex-row items-center gap-3.5 px-5 pt-4 pb-5">
        <Pressable onPress={onBack} className="w-10 h-10 rounded-xl border border-border-strong bg-bg-card items-center justify-center">
          <ChevronLeft size={20} color="#111418" />
        </Pressable>
        <View className="flex-1 gap-0.5">
          <Text className="text-[19px] font-extrabold tracking-tight">{t('inventoryCatalog.categoriesTitle')}</Text>
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.categoriesSubtitle')}</Text>
        </View>
        {isOwner && (
          <Pressable onPress={() => setShowAdd(true)} className="w-10 h-10 rounded-xl bg-primary items-center justify-center active:scale-95">
            <Plus size={20} strokeWidth={2.8} color="#FFFDFA" />
          </Pressable>
        )}
      </View>

      <ScrollView className="flex-1 px-5" contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {error && <Text className="text-[13px] font-semibold text-danger">{error}</Text>}

        <Pressable onPress={onOpenUnclassified} className="flex-row items-center gap-3.5 p-[15px] rounded-[17px] bg-bg-card border border-border active:scale-[0.98]">
          <View className="w-[46px] h-[46px] rounded-2xl bg-bg-elevated items-center justify-center">
            <Inbox size={22} color="#6B7280" />
          </View>
          <View className="flex-1 gap-0.5">
            <Text className="text-base font-bold">{t('inventoryCatalog.categoriesScreen.unclassified')}</Text>
            <Text className="text-[13px] text-text-dim">{t('inventoryCatalog.articleCount', { count: unclassifiedCount })}</Text>
          </View>
          <ChevronRight size={18} color="#A2A9B8" />
        </Pressable>

        {categories.length === 0 ? (
          <Text className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.noResults')}</Text>
        ) : (
          tree.map(renderNode)
        )}

        {showAdd && (
          <View className="p-4 rounded-[17px] bg-bg-card border border-border gap-3">
            <TextInput value={name} onChangeText={setName} placeholder={t('inventoryCatalog.categoryNamePlaceholder')} className="h-[48px] rounded-xl border border-border-strong bg-bg px-4 font-semibold" />
            {possibleParents.length > 0 && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                <Pressable onPress={() => setParentId('')} className={`px-3 py-2 rounded-xl border ${parentId === '' ? 'bg-info-bg border-primary' : 'bg-bg border-border'}`}>
                  <Text className="text-[13px] font-semibold">{t('inventoryCatalog.rootCategory')}</Text>
                </Pressable>
                {possibleParents.map((c) => (
                  <Pressable key={c.id} onPress={() => setParentId(c.id)} className={`px-3 py-2 rounded-xl border ${parentId === c.id ? 'bg-info-bg border-primary' : 'bg-bg border-border'}`}>
                    <Text className="text-[13px] font-semibold">
                      {'— '.repeat(c.depth - 1)}
                      {c.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <ColorPicker value={color} onChange={setColor} />
            <IconPicker value={icon} onChange={setIcon} />
            <View className="flex-row gap-2">
              <Pressable onPress={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl border border-border-strong items-center">
                <Text className="text-text-muted font-bold">{t('inventoryCatalog.cancel')}</Text>
              </Pressable>
              <Pressable onPress={handleCreate} disabled={busy || name.trim().length === 0} className="flex-1 py-2.5 rounded-xl bg-primary items-center disabled:opacity-50">
                <Text className="text-papier font-extrabold">{busy ? t('inventoryCatalog.creating') : t('inventoryCatalog.create')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View className="mt-2 p-4 rounded-2xl bg-info-bg border border-info-border flex-row gap-3">
          <Info size={20} color="#0E2038" style={{ marginTop: 2 }} />
          <Text className="flex-1 text-sm leading-relaxed text-[#33465E]">{t('inventoryCatalog.colorHint')}</Text>
        </View>
      </ScrollView>
    </View>
  )
}

/** Pastilles de couleur (palette partagée avec le bureau). */
export function ColorPicker({ value, onChange, disabled }: { value: string; onChange: (color: string) => void; disabled?: boolean }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {CATEGORY_COLORS.map((c) => (
        <Pressable
          key={c}
          onPress={() => onChange(c)}
          disabled={disabled}
          accessibilityLabel={c}
          className="w-8 h-8 rounded-full"
          style={{ backgroundColor: c, borderWidth: value.toLowerCase() === c.toLowerCase() ? 3 : 0, borderColor: '#0E2038' }}
        />
      ))}
    </View>
  )
}

/** Grille d'icônes (catalogue partagé avec le bureau) — rendue en emoji sur mobile ; la valeur stockée est la clé de l'icône. */
export function IconPicker({ value, onChange, disabled }: { value: string | null; onChange: (iconKey: string) => void; disabled?: boolean }) {
  return (
    <View className="flex-row flex-wrap gap-2">
      {CATEGORY_ICONS.map(({ key, emoji }) => (
        <Pressable
          key={key}
          onPress={() => onChange(key)}
          disabled={disabled}
          accessibilityLabel={key}
          className={`w-9 h-9 rounded-xl items-center justify-center ${value === key ? 'bg-info-bg border-2 border-primary' : 'bg-bg border border-border'}`}
        >
          <Text className="text-base">{emoji}</Text>
        </Pressable>
      ))}
    </View>
  )
}
