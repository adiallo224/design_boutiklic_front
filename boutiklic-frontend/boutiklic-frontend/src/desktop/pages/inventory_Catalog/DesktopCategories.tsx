import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Archive, ArrowLeft, ArrowRight, ChevronDown, ChevronUp, GripVertical, Inbox, Plus, Search, Tag, Trash2, TriangleAlert } from 'lucide-react'
import { CATEGORY_COLORS as COLORS, CATEGORY_ICONS, DEFAULT_CATEGORY_ICON } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { loadCatalogWithStock } from '../../../lib/productCatalog'
import { categoriesApi, type CategoryResponse } from '../../../lib/categoriesApi'
import { productsApi } from '../../../lib/productsApi'
import { taxApi, type TaxCategoryResponse } from '../../../lib/taxApi'
import { formatTaxRate, inheritedTax } from '../../../lib/taxInheritance'
import { useTenant } from '../../../hooks/useTenant'
import { buildCategoryTree, descendantAndSelfIds, flattenCategoryTree, type CategoryTreeNode } from '../../../lib/categoryTree'
import { toErrorMessage } from '../../../lib/apiClient'
import type { Product } from '../../../types'
import MasterDetailLayout from '../../components/MasterDetailLayout'
import Button from '../../components/Button'
import Modal from '../../components/Modal'
import CategoryIcon from '../../components/CategoryIcon'
import { useTopBar } from '../../hooks/useTopBar'

/** Profondeur maximale acceptée par le backend (CategoryCommandService.MAX_DEPTH). */
const MAX_DEPTH = 3
const UNCLASSIFIED = '__unclassified__'
/** W37 — arbre de catégories (gauche) + détail éditable (droite). Les écritures sont réservées au propriétaire
 *  (CategoryController). Suppression : articles -> « Non classés », sous-catégories remontées d'un niveau. */
export default function DesktopCategories() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const isOwner = user?.role === 'OWNER'
  const { tenant } = useTenant()

  const [categories, setCategories] = useState<CategoryResponse[]>([])
  const [taxCategories, setTaxCategories] = useState<TaxCategoryResponse[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<CategoryResponse | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [justCreatedId, setJustCreatedId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const catalog = await loadCatalogWithStock()
      setCategories(catalog.categories)
      setProducts(catalog.products)
    } catch (e) {
      setError(toErrorMessage(e))
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setIsLoading(false))
  }, [refresh])

  useEffect(() => {
    taxApi.getActiveCategories().then(setTaxCategories).catch(() => undefined)
  }, [])

  /** Exécute une écriture puis resynchronise ; toute erreur est affichée et l'état serveur est rechargé. */
  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      setError(null)
      try {
        const result = await action()
        await refresh()
        return result
      } catch (e) {
        setError(toErrorMessage(e))
        await refresh()
        return undefined
      }
    },
    [refresh],
  )

  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const tree = useMemo(() => buildCategoryTree(categories), [categories])
  const unclassified = useMemo(() => products.filter((p) => !p.categoryId || !byId.has(p.categoryId)), [products, byId])
  const selected = selectedId && selectedId !== UNCLASSIFIED ? (byId.get(selectedId) ?? null) : null

  const branchCount = (categoryId: string) => {
    const ids = descendantAndSelfIds(categoryId, categories)
    return products.filter((p) => p.categoryId && ids.has(p.categoryId)).length
  }
  const directCount = (categoryId: string) => products.filter((p) => p.categoryId === categoryId).length
  const siblingsOf = (parentId: string | null) =>
    categories
      .filter((c) => (c.parentId ?? null) === parentId)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name))

  const uniqueName = (base: string) => {
    const taken = new Set(categories.map((c) => c.name.toLowerCase()))
    let name = base
    for (let n = 2; taken.has(name.toLowerCase()); n++) name = `${base} ${n}`
    return name
  }

  // --- Écritures ---------------------------------------------------------------------------------------------

  const addCategory = async (parent: CategoryResponse | null) => {
    const created = await run(() =>
      categoriesApi.create({
        name: uniqueName(parent ? t('inventoryCatalog.categoriesScreen.newSubcategoryDefaultName') : t('inventoryCatalog.categoriesScreen.newCategoryDefaultName')),
        color: parent?.color ?? COLORS[0],
        icon: parent?.icon ?? DEFAULT_CATEGORY_ICON,
        parentId: parent?.id,
      }),
    )
    if (!created) return
    if (parent) setCollapsed((prev) => { const next = new Set(prev); next.delete(parent.id); return next })
    setSearch('')
    setSelectedId(created.id)
    setJustCreatedId(created.id)
  }

  // addCategory lit l'état courant (noms déjà pris) : la TopBar n'est republiée que sur les primitives de `deps`, on passe par une ref.
  const addRootRef = useRef<() => void>(() => {})
  addRootRef.current = () => { addCategory(null) }
  useTopBar(
    {
      title: t('inventoryCatalog.categoriesTitle'),
      primaryAction: isOwner ? { label: t('inventoryCatalog.categoriesScreen.newCategory'), icon: <Plus size={16} />, onClick: () => addRootRef.current() } : undefined,
    },
    [t, isOwner],
  )

  useEffect(() => {
    if (justCreatedId && selectedId !== justCreatedId) setJustCreatedId(null)
  }, [selectedId, justCreatedId])

  const saveCategory = (category: CategoryResponse, patch: Partial<Pick<CategoryResponse, 'name' | 'color' | 'icon' | 'parentId'>>) =>
    run(() => {
      const next = { ...category, ...patch }
      return categoriesApi.update(category.id, { name: next.name, color: next.color, icon: next.icon ?? undefined, parentId: next.parentId })
    })

  const changeCategoryTax = (category: CategoryResponse, taxCategoryId: string | null) =>
    run(() => categoriesApi.changeTaxCategory(category.id, taxCategoryId))

  const applyOrder = async (parentId: string | null, orderedIds: string[]) => {
    const positions = new Map(orderedIds.map((id, index) => [id, index]))
    setCategories((prev) => prev.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c)))
    await run(() => categoriesApi.reorder(parentId, orderedIds))
  }

  const move = (category: CategoryResponse, direction: -1 | 1) => {
    const ids = siblingsOf(category.parentId ?? null).map((c) => c.id)
    const from = ids.indexOf(category.id)
    const to = from + direction
    if (from < 0 || to < 0 || to >= ids.length) return
    ;[ids[from], ids[to]] = [ids[to], ids[from]]
    applyOrder(category.parentId ?? null, ids)
  }

  /** Glisser-déposer : seulement entre frères (même parent). Le glissé prend la place de la cible (avant si on monte, après si on descend). */
  const canDropOn = (target: CategoryResponse) => {
    const dragged = dragId ? byId.get(dragId) : null
    return !!dragged && dragged.id !== target.id && (dragged.parentId ?? null) === (target.parentId ?? null)
  }
  const dropOn = (target: CategoryResponse) => {
    const dragged = dragId ? byId.get(dragId) : null
    const allowed = canDropOn(target)
    setDragId(null)
    if (!dragged || !allowed) return
    const ids = siblingsOf(dragged.parentId ?? null).map((c) => c.id)
    ids.splice(ids.indexOf(dragged.id), 1)
    const targetIndex = siblingsOf(dragged.parentId ?? null).findIndex((c) => c.id === target.id)
    ids.splice(targetIndex, 0, dragged.id)
    applyOrder(dragged.parentId ?? null, ids)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    const target = deleteTarget
    const ok = await run(async () => { await categoriesApi.remove(target.id); return true })
    setDeleting(false)
    setDeleteTarget(null)
    if (ok) setSelectedId(target.parentId ?? null)
  }

  const assignProduct = async (productId: string, categoryId: string) => {
    const target = categoryId || null
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, categoryId: target ?? undefined } : p)))
    await run(() => productsApi.changeCategory(productId, target))
  }

  // --- Arbre ---------------------------------------------------------------------------------------------------

  const query = search.trim().toLowerCase()
  const filterNode = (node: CategoryTreeNode, ancestorMatches: boolean): CategoryTreeNode | null => {
    if (!query) return node
    const matches = node.category.name.toLowerCase().includes(query)
    const children = node.children.map((c) => filterNode(c, ancestorMatches || matches)).filter((c): c is CategoryTreeNode => c !== null)
    return matches || ancestorMatches || children.length > 0 ? { ...node, children } : null
  }
  const visibleTree = tree.map((n) => filterNode(n, false)).filter((n): n is CategoryTreeNode => n !== null)

  const renderNode = (node: CategoryTreeNode): ReactNode => {
    const { category } = node
    const isRoot = category.depth === 1
    const hasChildren = node.children.length > 0
    const isOpen = hasChildren && (query ? true : !collapsed.has(category.id))
    const isSelected = selectedId === category.id
    const siblings = siblingsOf(category.parentId ?? null)
    const index = siblings.findIndex((c) => c.id === category.id)
    const tile = isRoot ? 'w-[22px] h-[22px] rounded-[7px]' : 'w-[18px] h-[18px] rounded-md'

    return (
      <div key={category.id} className={isRoot ? 'mb-0.5' : ''}>
        <div
          className={`flex items-center gap-1 pr-1.5 rounded-[10px] ${isSelected ? 'bg-bg-elevated' : 'hover:bg-bg'} ${dragId === category.id ? 'opacity-40' : ''}`}
          onDragOver={(e) => { if (canDropOn(category)) e.preventDefault() }}
          onDrop={() => dropOn(category)}
        >
          {isRoot ? (
            <button
              type="button"
              onClick={() => setCollapsed((prev) => { const next = new Set(prev); if (next.has(category.id)) next.delete(category.id); else next.add(category.id); return next })}
              aria-label={t('inventoryCatalog.toggleSubcategories')}
              className={`w-7 h-9 flex-none flex items-center justify-center text-text-dim ${hasChildren ? '' : 'invisible'}`}
            >
              <ChevronDown size={16} className={`transition-transform ${isOpen ? '' : '-rotate-90'}`} />
            </button>
          ) : null}
          <button type="button" onClick={() => setSelectedId(category.id)} className={`flex-1 min-w-0 flex items-center gap-2 text-left cursor-pointer ${isRoot ? 'py-2' : 'py-1.5'}`}>
            <span className={`${tile} flex-none flex items-center justify-center text-papier`} style={{ background: category.color }}>
              <CategoryIcon icon={category.icon} size={isRoot ? 14 : 11} />
            </span>
            <span className={`flex-1 min-w-0 truncate ${isRoot ? 'text-sm font-bold' : 'text-[13px] font-semibold'}`}>{category.name}</span>
            <span className="flex-none text-xs font-bold text-text-dim bg-bg-elevated px-2 py-0.5 rounded-full tabular-nums">{branchCount(category.id)}</span>
          </button>
          {isOwner && (
            <>
              <div className="flex flex-col flex-none">
                <button type="button" title={t('inventoryCatalog.categoriesScreen.moveUp')} aria-label={t('inventoryCatalog.categoriesScreen.moveUp')} disabled={index <= 0} onClick={() => move(category, -1)} className="h-4 text-text-placeholder hover:text-text disabled:opacity-30 flex items-center">
                  <ChevronUp size={14} />
                </button>
                <button type="button" title={t('inventoryCatalog.categoriesScreen.moveDown')} aria-label={t('inventoryCatalog.categoriesScreen.moveDown')} disabled={index < 0 || index >= siblings.length - 1} onClick={() => move(category, 1)} className="h-4 text-text-placeholder hover:text-text disabled:opacity-30 flex items-center">
                  <ChevronDown size={14} />
                </button>
              </div>
              {isRoot && (
              <span
                draggable
                onDragStart={() => setDragId(category.id)}
                onDragEnd={() => setDragId(null)}
                title={t('inventoryCatalog.categoriesScreen.drag')}
                className="flex-none text-border-strong cursor-grab"
              >
                <GripVertical size={16} />
              </span>
              )}
            </>
          )}
        </div>
        {(isOpen || (isSelected && !hasChildren && category.depth < MAX_DEPTH)) && (
          <div className="pl-[30px] flex flex-col gap-px">
            {isOpen && node.children.map(renderNode)}
            {isOwner && !query && category.depth < MAX_DEPTH && (isRoot || isSelected) && (
              <button type="button" onClick={() => addCategory(category)} className="flex items-center gap-1.5 px-2 py-1.5 text-xs font-bold text-text-dim hover:text-info-text">
                <Plus size={14} />
                {t('inventoryCatalog.categoriesScreen.addSubcategory')}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  const master = (
    <div className="flex flex-col min-h-full bg-bg-card">
      <div className="sticky top-0 z-10 bg-bg-card px-4 py-3.5 border-b border-border-hairline">
        <div className="text-xs text-text-muted mb-2.5">{t('inventoryCatalog.categoriesScreen.summary', { categories: categories.length, articles: products.length })}</div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-[10px] bg-bg border border-border">
          <Search size={16} className="text-text-dim flex-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('inventoryCatalog.searchCategoryEllipsis')}
            className="w-full bg-transparent outline-none text-sm"
          />
        </label>
      </div>
      <div className="p-2">
        <button
          type="button"
          onClick={() => setSelectedId(UNCLASSIFIED)}
          className={`w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[10px] text-left mb-1 ${selectedId === UNCLASSIFIED ? 'bg-bg-elevated' : 'hover:bg-bg'}`}
        >
          <span className="w-[22px] h-[22px] rounded-[7px] bg-bg-elevated text-text-dim flex items-center justify-center flex-none"><Inbox size={14} /></span>
          <span className="flex-1 text-sm font-bold">{t('inventoryCatalog.categoriesScreen.unclassified')}</span>
          <span className="text-xs font-bold text-text-dim bg-bg-elevated px-2 py-0.5 rounded-full tabular-nums">{unclassified.length}</span>
        </button>
        <div className="h-px bg-border-hairline mx-1 mt-1.5 mb-2" />
        {isLoading ? (
          <div className="p-3 text-[13px] font-semibold text-text-dim">{t('common.loading')}</div>
        ) : visibleTree.length === 0 ? (
          <div className="p-3 text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.noResults')}</div>
        ) : (
          visibleTree.map(renderNode)
        )}
      </div>
    </div>
  )

  // --- Détail --------------------------------------------------------------------------------------------------

  const categoryOptions = flattenCategoryTree(categories)
  const backButton = (
    <button type="button" onClick={() => setSelectedId(null)} aria-label={t('auth.back')} className="lg:hidden self-start -mb-2 w-9 h-9 flex items-center justify-center rounded-[10px] text-text-dim hover:bg-bg-elevated hover:text-text">
      <ArrowLeft size={20} />
    </button>
  )

  const detail = selectedId === UNCLASSIFIED ? (
    <div className="max-w-[720px] p-4 sm:p-6 lg:p-8 flex flex-col gap-6">
      {backButton}
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-[11px] bg-bg-elevated text-text-dim flex items-center justify-center"><Inbox size={22} /></span>
        <div>
          <h2 className="font-display text-[22px] font-extrabold">{t('inventoryCatalog.categoriesScreen.unclassified')}</h2>
          <span className="text-[13px] text-text-muted">{t('inventoryCatalog.categoriesScreen.unclassifiedSubtitle', { count: unclassified.length })}</span>
        </div>
      </div>
      <div className="border border-border rounded-2xl overflow-hidden bg-bg-card">
        {unclassified.length === 0 ? (
          <div className="p-6 text-sm font-semibold text-text-dim text-center">{t('inventoryCatalog.categoriesScreen.unclassifiedEmpty')}</div>
        ) : (
          unclassified.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 border-b border-border-hairline last:border-b-0">
              <span className="flex-1 min-w-[140px] truncate text-sm font-semibold">{p.name}</span>
              {isOwner && (
                <select
                  value=""
                  onChange={(e) => assignProduct(p.id, e.target.value)}
                  className="h-9 rounded-[9px] border border-border bg-bg px-2.5 text-[13px] outline-none focus:border-primary"
                >
                  <option value="">{t('inventoryCatalog.categoriesScreen.assignTo')}</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>{'— '.repeat(c.depth - 1)}{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  ) : selected ? (
    <CategoryDetail
      key={selected.id}
      category={selected}
      isOwner={isOwner}
      autoFocusName={justCreatedId === selected.id}
      subcategoryCount={categories.filter((c) => c.parentId === selected.id).length}
      productCount={directCount(selected.id)}
      onSave={(patch) => saveCategory(selected, patch)}
      categories={categories}
      taxCategories={taxCategories}
      shopDefaultTaxCategoryId={tenant.defaultTaxCategoryId}
      taxEnabled={tenant.taxEnabled}
      onChangeTax={(taxCategoryId) => changeCategoryTax(selected, taxCategoryId)}
      onDelete={() => setDeleteTarget(selected)}
      backButton={backButton}
    />
  ) : (
    <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-2.5 text-text-dim text-center">
      <Tag size={40} className="text-text-placeholder" />
      <p className="text-base font-semibold text-text-secondary">{t('inventoryCatalog.categoriesScreen.selectTitle')}</p>
      <p className="text-sm max-w-[280px]">{t('inventoryCatalog.categoriesScreen.selectHint')}</p>
    </div>
  )

  const deleteChildren = deleteTarget ? categories.filter((c) => c.parentId === deleteTarget.id).length : 0
  const deleteProducts = deleteTarget ? directCount(deleteTarget.id) : 0

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex-1 min-h-0">
        <MasterDetailLayout master={master} detail={detail} masterWidth="320px" resizable={{ min: 260, max: 640, storageKey: 'boutiklic.categories.masterWidth' }} activePane={selectedId === UNCLASSIFIED || selected ? 'detail' : 'master'} />
      </div>

      {error && <div className="fixed bottom-4 left-4 right-4 sm:right-auto z-30 sm:max-w-[420px] rounded-xl bg-bg-card border border-danger px-4 py-2.5 text-[13px] font-semibold text-danger shadow-lg">{error}</div>}

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        width={440}
        title={deleteTarget ? t('inventoryCatalog.categoriesScreen.deleteTitle', { name: deleteTarget.name }) : undefined}
        footer={
          <div className="flex justify-end gap-2.5">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>{t('inventoryCatalog.cancel')}</Button>
            <Button variant="danger" onClick={confirmDelete} loading={deleting}>{t('inventoryCatalog.categoriesScreen.delete')}</Button>
          </div>
        }
      >
        <div className="flex gap-3">
          <span className="w-10 h-10 rounded-[11px] bg-danger/10 text-danger flex items-center justify-center flex-none"><TriangleAlert size={22} /></span>
          <p className="text-sm text-text-secondary leading-relaxed">
            {deleteProducts > 0 && <>{t('inventoryCatalog.categoriesScreen.deleteProducts', { count: deleteProducts })} </>}
            {deleteChildren > 0 && <>{t('inventoryCatalog.categoriesScreen.deleteChildren', { count: deleteChildren })} </>}
            {t('inventoryCatalog.categoriesScreen.deleteIrreversible')}
          </p>
        </div>
      </Modal>
    </div>
  )
}

interface CategoryDetailProps {
  category: CategoryResponse
  isOwner: boolean
  autoFocusName: boolean
  subcategoryCount: number
  productCount: number
  onSave: (patch: Partial<Pick<CategoryResponse, 'name' | 'color' | 'icon' | 'parentId'>>) => Promise<unknown>
  categories: CategoryResponse[]
  taxCategories: TaxCategoryResponse[]
  shopDefaultTaxCategoryId: string | null
  taxEnabled: boolean
  /** null = retirer la TVA propre (la catégorie hérite alors de son parent, puis de la boutique). */
  onChangeTax: (taxCategoryId: string | null) => Promise<unknown>
  onDelete: () => void
  backButton: ReactNode
}

function CategoryDetail({ category, isOwner, autoFocusName, subcategoryCount, productCount, onSave, categories, taxCategories, shopDefaultTaxCategoryId, taxEnabled, onChangeTax, onDelete, backButton }: CategoryDetailProps) {
  const { t } = useTranslation()
  // Ce que la catégorie hérite tant qu'elle n'a pas de TVA propre : son parent (le plus proche qui en porte une), sinon la boutique.
  const inherited = inheritedTax(category.parentId, categories, taxCategories, shopDefaultTaxCategoryId, taxEnabled)
  const inheritedLabel = inherited.taxCategory
    ? t(inherited.source === 'category' ? 'inventoryCatalog.taxInheritedFromCategory' : 'inventoryCatalog.taxInheritedFromShop', { rate: formatTaxRate(inherited.taxCategory.ratePercent) })
    : t('inventoryCatalog.taxNone')
  const [name, setName] = useState(category.name)
  useEffect(() => setName(category.name), [category.name])

  const commitName = async () => {
    const next = name.trim()
    if (next === category.name) return
    if (next.length === 0) {
      setName(category.name)
      return
    }
    await onSave({ name: next })
    // En cas de refus serveur (nom déjà pris), la liste est rechargée avec l'ancien nom : on réaligne le champ.
    setName((current) => (current.trim() === next ? category.name : current))
  }

  const isRoot = category.depth === 1
  const subtitle = isRoot
    ? subcategoryCount > 0
      ? t('inventoryCatalog.categoriesScreen.subcategoriesCount', { count: subcategoryCount })
      : t('inventoryCatalog.categoriesScreen.mainCategory')
    : t('inventoryCatalog.categoriesScreen.subcategory')

  return (
    <div className="max-w-[720px] p-4 sm:p-6 lg:p-8 lg:pr-10 flex flex-col gap-6 lg:gap-8">
      {backButton}
      <div className="flex flex-wrap items-start gap-4">
        <span className="w-12 h-12 rounded-[13px] flex items-center justify-center flex-none text-papier" style={{ background: category.color }}>
          <CategoryIcon icon={category.icon} size={26} />
        </span>
        <div className="flex-1 min-w-[180px] flex flex-col gap-1.5">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') { setName(category.name); e.currentTarget.blur() }
            }}
            readOnly={!isOwner}
            autoFocus={autoFocusName}
            onFocus={(e) => autoFocusName && e.currentTarget.select()}
            maxLength={100}
            aria-label={t('inventoryCatalog.categoryNamePlaceholder')}
            className="w-full font-display text-xl sm:text-[26px] font-extrabold tracking-tight px-2 py-1 rounded-lg border border-transparent bg-transparent hover:bg-bg hover:border-border focus:bg-bg-card focus:border-border-strong outline-none"
          />
          <span className="text-[13px] text-text-muted px-2">{subtitle}</span>
        </div>
        {isOwner && (
          <button type="button" onClick={onDelete} className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] border border-border bg-bg-card text-danger font-bold text-[13px] hover:bg-danger/10">
            <Trash2 size={16} />
            {t('inventoryCatalog.categoriesScreen.delete')}
          </button>
        )}
      </div>

      <Section title={t('inventoryCatalog.categoriesScreen.appearance')}>
        <div className="flex flex-wrap gap-5">
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-secondary">{t('inventoryCatalog.categoriesScreen.color')}</span>
            <div className="flex flex-wrap gap-2 max-w-[340px]">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  disabled={!isOwner}
                  onClick={() => onSave({ color: c })}
                  aria-label={c}
                  className={`w-7 h-7 rounded-[9px] border-2 ${category.color.toLowerCase() === c.toLowerCase() ? 'border-text' : 'border-bg-card'}`}
                  style={{ background: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-semibold text-text-secondary">{t('inventoryCatalog.categoriesScreen.icon')}</span>
            <div className="flex flex-wrap gap-2 sm:max-w-[340px]">
              {CATEGORY_ICONS.map(({ key }) => {
                const active = category.icon === key
                return (
                  <button
                    key={key}
                    type="button"
                    disabled={!isOwner}
                    onClick={() => onSave({ icon: key })}
                    title={key.replace(/_/g, ' ')}
                    aria-label={key}
                    className={`w-8 h-8 rounded-[9px] flex items-center justify-center border ${active ? 'bg-[#1E3A5F] border-[#1E3A5F] text-papier' : 'bg-bg border-border text-text-dim hover:border-border-strong'}`}
                  >
                    <CategoryIcon icon={key} size={17} />
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </Section>

      {taxCategories.length > 0 && (
        <Section title={t('inventoryCatalog.categoriesScreen.taxTitle')}>
          <div className="flex flex-col gap-2 px-5 py-4 rounded-2xl border border-border bg-bg-card">
            <span className="text-[13px] font-semibold text-text-secondary">{t('inventoryCatalog.categoriesScreen.taxLabel')}</span>
            <select
              value={category.taxCategoryId ?? ''}
              disabled={!isOwner}
              onChange={(e) => onChangeTax(e.target.value || null)}
              className="h-11 rounded-xl border border-border-strong bg-bg px-3.5 text-sm font-semibold outline-none focus:border-primary max-w-[420px]"
            >
              <option value="">{inheritedLabel}</option>
              {taxCategories.map((c) => (
                <option key={c.id} value={c.id}>{t('inventoryCatalog.taxRateOption', { name: c.name, rate: formatTaxRate(c.ratePercent) })}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted leading-relaxed">
              {taxEnabled ? t('inventoryCatalog.categoriesScreen.taxHelp') : t('inventoryCatalog.categoriesScreen.taxDisabledHelp')}
            </p>
          </div>
        </Section>
      )}

      <Section title={t('inventoryCatalog.categoriesScreen.articles')}>
        <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 rounded-2xl border border-border bg-bg-card">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-[10px] bg-bg-elevated text-text-dim flex items-center justify-center"><Archive size={19} /></span>
            <div>
              <div className="font-extrabold text-lg tabular-nums">{productCount}</div>
              <div className="text-[13px] text-text-muted">{t('inventoryCatalog.categoriesScreen.articlesInCategory')}</div>
            </div>
          </div>
          <Link to="/stock" className="flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-bg-elevated text-info-text font-bold text-[13px] hover:opacity-80">
            {t('inventoryCatalog.categoriesScreen.seeInStock')}
            <ArrowRight size={16} />
          </Link>
        </div>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-bold tracking-[0.08em] uppercase text-text-muted">{title}</span>
      {children}
    </div>
  )
}
