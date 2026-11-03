import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Archive, Wallet, AlertTriangle, ShoppingCart, Download, Upload, ScanBarcode, Truck, Package, PackageSearch, ArrowRight, Printer } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useLocation, useNavigate } from 'react-router-dom'
import { effectiveUnitCost, formatDate, formatNumber, isSupportedLocale, DEFAULT_LOCALE } from '@boutiklic/shared'
import { useAuth } from '../../../hooks/useAuth'
import { useTenant } from '../../../hooks/useTenant'
import { loadCatalogWithStock } from '../../../lib/productCatalog'
import { inventoryApi, type StockIntakeResponse } from '../../../lib/inventoryApi'
import { suppliersApi } from '../../../lib/suppliersApi'
import { resellerApi, type ResellersTotalResponse } from '../../../lib/resellerApi'
import { toErrorMessage } from '../../../lib/apiClient'
import { labelsNavigation } from '../../../lib/labelPrint'
import type { Product } from '../../../types'
import Table from '../../components/Table'
import type { TableColumn } from '../../components/Table'
import HorizontalScroller from '../../components/HorizontalScroller'
import Pagination from '../../components/Pagination'
import { useTopBar } from '../../hooks/useTopBar'
import BarcodeScannerModal from '../../../components/BarcodeScannerModal'
import ProductSheetModalDesktop from './ProductSheetModalDesktop'
import DesktopFirstDay from './DesktopFirstDay'

const FIRST_DAY_DONE_KEY = 'boutiklic_first_day_done'
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50, 100]

type SortKey = 'name' | 'category' | 'quantity' | 'purchasePrice' | 'salePrice' | 'margin'
type StatusFilter = '' | 'LOW' | 'OUT' | string

function statusOf(p: Product): 'out' | 'low' | 'ok' {
  if (p.quantity === 0) return 'out'
  if (p.quantity <= p.alertThreshold) return 'low'
  return 'ok'
}

/** W4 — refonte visuelle (étude study/web/stock_web_page_redesign) : 4 tuiles KPI, filtres par
 *  catégorie + stock bas/rupture (dérivés du catalogue déjà chargé, pas d'appel supplémentaire),
 *  tableau enrichi (photo, code-barres, barre de niveau, statut) avec pagination, et 3 cartes
 *  d'activité réelles en bas d'écran. Composition neuve (Tier B) : StockFlow.tsx mélange
 *  Stock/Catégories/Arrivages/Promotions/Revendeurs dans une seule cascade mobile qui ne correspond
 *  pas à l'IA bureau — on réutilise seulement loadCatalogWithStock(), pas le contrôleur.
 *
 *  Écarts assumés vis-à-vis du mockup (rien à fabriquer côté API) :
 *  - Pas de nom d'entrepôt ("Entrepôt Madina") : un seul stock par boutique, aucune notion
 *    d'emplacement multiple n'existe côté modèle.
 *  - Pas d'unité par article ("sacs", "bidons"...) ni de fournisseur par article : ProductResponse
 *    n'a ni l'un ni l'autre (même écart déjà documenté dans DesktopAlerts.tsx).
 *  - "% capacité" du mockup implique une capacité d'entrepôt qui n'existe pas — remplacé par une
 *    barre de niveau relative au seuil d'alerte (quantité / 3×seuil), sans pourcentage affiché pour
 *    ne pas laisser croire à une précision qui n'existe pas.
 *  - "Exporter" ouvre l'écran Exports d'inventaire (/stock/exports : Excel, PDF, CSV). Le ZIP de CSV
 *    ventes/stock/dettes/fournisseurs reste dans Réglages → Exporter mes données.
 *  - "Scan inventaire" réutilise BarcodeScannerModal (déjà utilisé en caisse) : un code scanné qui
 *    correspond à un article l'ouvre directement en édition ; sinon la recherche affiche "aucun
 *    résultat", pas de fausse fonctionnalité d'inventaire physique complet.
 *  - Carte "Base inventaire locale sécurisée" du mockup retirée : aucune validation de hash SQLite
 *    n'est exposée côté app — remplacée par une carte "Alertes de stock" (rupture + stock bas),
 *    réelle et déjà utile, vers /stock/alertes. */
export default function DesktopStock() {
  const { t, i18n } = useTranslation()
  const locale = isSupportedLocale(i18n.language) ? i18n.language : DEFAULT_LOCALE
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { formatCurrency, formatUnitPrice } = useTenant()
  const isOwner = user?.role === 'OWNER'
  /** Impression d'étiquettes : propriétaire et vendeurs, comme la modification d'article. */
  const canPrintLabels = user?.role === 'OWNER' || user?.role === 'SELLER'
  const [firstDayDismissed, setFirstDayDismissed] = useState(() => localStorage.getItem(FIRST_DAY_DONE_KEY) === 'true')

  const [products, setProducts] = useState<Product[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [stockAsOf, setStockAsOf] = useState<string | null>(null)
  // Recherche lancée depuis la barre du tableau de bord (Entrée -> navigate('/stock', { state })) —
  // reprise une seule fois au montage, l'historique de navigation ne doit pas la réappliquer.
  const [searchQuery, setSearchQuery] = useState(() => (location.state as { initialSearchQuery?: string } | null)?.initialSearchQuery ?? '')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [creating, setCreating] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  /** Articles cochés pour l'impression d'étiquettes (tous filtres et pages confondus). */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [lastIntake, setLastIntake] = useState<StockIntakeResponse | null>(null)
  const [lastIntakeSupplier, setLastIntakeSupplier] = useState<string | null>(null)
  const [resellerTotal, setResellerTotal] = useState<ResellersTotalResponse | null>(null)

  const load = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await loadCatalogWithStock()
      setProducts(result.products)
      setStockAsOf(result.stockAsOf)
    } catch (e) {
      setError(toErrorMessage(e))
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    inventoryApi.getIntakes().then((intakes) => {
      const latest = [...intakes].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
      setLastIntake(latest)
      if (latest?.supplierId) {
        suppliersApi.getById(latest.supplierId).then((s) => setLastIntakeSupplier(s.name)).catch(() => undefined)
      }
    }).catch(() => undefined)
    resellerApi.getTotal().then(setResellerTotal).catch(() => undefined)
  }, [])

  useTopBar(
    {
      searchValue: searchQuery,
      onSearchChange: setSearchQuery,
      searchPlaceholder: t('inventoryCatalog.searchProductPlaceholder'),
    },
    [t, searchQuery],
  )

  useEffect(() => setPage(1), [searchQuery, statusFilter, pageSize])

  const ruptureCount = products.filter((p) => p.quantity === 0).length
  const alerteCount = products.filter((p) => p.quantity > 0 && p.quantity <= p.alertThreshold).length
  // Valorisé au coût unitaire EXACT, comme le tableau de bord serveur (un lot de 3 boîtes à 1 000 vaut 1 000, pas 999).
  const stockValue = products.reduce((s, p) => s + effectiveUnitCost(p) * p.quantity, 0)
  const marginableValue = products.reduce((s, p) => s + p.salePrice * p.quantity, 0)
  const avgMarginPct = marginableValue > 0 ? ((marginableValue - stockValue) / marginableValue) * 100 : 0

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    products.forEach((p) => counts.set(p.category, (counts.get(p.category) ?? 0) + 1))
    return Array.from(counts.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [products])

  const pills: { id: StatusFilter; label: string }[] = [
    { id: '', label: `${t('inventoryCatalog.filterAll')} (${products.length})` },
    ...categories.map(([name, count]) => ({ id: name, label: `${name} (${count})` })),
    { id: 'LOW', label: `${t('inventoryCatalog.filterLowStock')} (${alerteCount})` },
    { id: 'OUT', label: `${t('inventoryCatalog.filterOutOfStock')} (${ruptureCount})` },
  ]

  const onSort = (key: string) => {
    if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortKey(key as SortKey)
      setSortDir('asc')
    }
  }

  const filteredRows = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const filtered = products.filter((p) => {
      const matchesSearch = !q || p.name.toLowerCase().includes(q) || p.barcode?.toLowerCase().includes(q)
      const matchesStatus =
        statusFilter === '' ? true :
        statusFilter === 'LOW' ? statusOf(p) === 'low' :
        statusFilter === 'OUT' ? statusOf(p) === 'out' :
        p.category === statusFilter
      return matchesSearch && matchesStatus
    })
    const margin = (p: Product) => (p.salePrice > 0 ? ((p.salePrice - effectiveUnitCost(p)) / p.salePrice) * 100 : 0)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'category': return a.category.localeCompare(b.category) * dir
        case 'quantity': return (a.quantity - b.quantity) * dir
        case 'purchasePrice': return (a.purchasePrice - b.purchasePrice) * dir
        case 'salePrice': return (a.salePrice - b.salePrice) * dir
        case 'margin': return (margin(a) - margin(b)) * dir
        default: return a.name.localeCompare(b.name) * dir
      }
    })
  }, [products, searchQuery, statusFilter, sortKey, sortDir])

  const allFilteredSelected = filteredRows.length > 0 && filteredRows.every((p) => selectedIds.has(p.id))
  const toggleSelected = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  /** La case d'en-tête agit sur TOUS les articles filtrés (pas seulement la page affichée) : 200 articles = un clic. */
  const toggleAllFiltered = () =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) filteredRows.forEach((p) => next.delete(p.id))
      else filteredRows.forEach((p) => next.add(p.id))
      return next
    })
  const printSelectedLabels = () => {
    const target = labelsNavigation([...selectedIds].map((productId) => ({ productId, copies: 1 })))
    navigate(target.to, target.state ? { state: target.state } : undefined)
  }

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pageRows = filteredRows.slice((page - 1) * pageSize, page * pageSize)

  const handleScanDetected = (code: string) => {
    setShowScanner(false)
    const match = products.find((p) => p.barcode === code)
    if (match) {
      setEditingProduct(match)
    } else {
      setSearchQuery(code)
    }
  }

  const columns: TableColumn<Product>[] = [
    ...(canPrintLabels
      ? [
          {
            key: 'select',
            label: t('labels.selection.selectAllAria'),
            width: '44px',
            headerContent: (
              <input
                type="checkbox"
                checked={allFilteredSelected}
                onChange={toggleAllFiltered}
                onClick={(e) => e.stopPropagation()}
                aria-label={t('labels.selection.selectAllAria') ?? undefined}
                className="w-4 h-4 accent-[#0E2038]"
              />
            ),
            render: (p: Product) => (
              <input
                type="checkbox"
                checked={selectedIds.has(p.id)}
                onChange={() => toggleSelected(p.id)}
                onClick={(e) => e.stopPropagation()}
                aria-label={t('labels.selection.selectAria', { name: p.name }) ?? undefined}
                className="w-4 h-4 accent-[#0E2038]"
              />
            ),
          } satisfies TableColumn<Product>,
        ]
      : []),
    {
      key: 'name',
      label: t('inventoryCatalog.productAndRefColumn'),
      sortable: true,
      render: (p) => (
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-bg-elevated flex-none flex items-center justify-center text-base overflow-hidden">
            {p.imageUrl ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" /> : '📦'}
          </div>
          <div className="min-w-0">
            <div className="font-bold truncate">{p.name}</div>
            {p.barcode && <div className="amount text-[11px] text-text-dim truncate">{p.barcode}</div>}
          </div>
        </div>
      ),
    },
    { key: 'category', label: t('inventoryCatalog.categoryLabel'), sortable: true, render: (p) => p.category },
    {
      key: 'quantity',
      label: t('inventoryCatalog.stockColumnLabel'),
      sortable: true,
      numeric: true,
      render: (p) => {
        const status = statusOf(p)
        const color = status === 'out' ? 'text-danger' : status === 'low' ? 'text-alerte-text' : 'text-text'
        const barColor = status === 'out' ? 'bg-danger' : status === 'low' ? 'bg-warning' : 'bg-success'
        const ratio = p.alertThreshold > 0 ? Math.min(1, p.quantity / (p.alertThreshold * 3)) : p.quantity > 0 ? 1 : 0
        return (
          <div className="flex flex-col gap-1 items-end">
            <span className={`amount font-extrabold ${color}`}>{p.quantity}</span>
            <div className="w-16 h-1.5 rounded-full bg-bg-elevated overflow-hidden">
              <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.round(ratio * 100)}%` }} />
            </div>
          </div>
        )
      },
    },
    { key: 'alertThreshold', label: t('inventoryCatalog.alertThresholdColumnLabel'), numeric: true, render: (p) => p.alertThreshold },
    { key: 'purchasePrice', label: t('inventoryCatalog.purchasePriceLabel'), sortable: true, numeric: true, render: (p) => formatCurrency(p.purchasePrice) },
    { key: 'salePrice', label: t('inventoryCatalog.salePriceLabel'), sortable: true, numeric: true, render: (p) => formatUnitPrice(p.salePrice) },
    {
      key: 'margin',
      label: '%',
      sortable: true,
      numeric: true,
      render: (p) => (p.salePrice > 0 ? `${(((p.salePrice - effectiveUnitCost(p)) / p.salePrice) * 100).toFixed(1)} %` : '—'),
    },
    {
      key: 'status',
      label: t('inventoryCatalog.statusColumn'),
      render: (p) => {
        const status = statusOf(p)
        const dotColor = status === 'out' ? 'bg-danger' : status === 'low' ? 'bg-warning' : 'bg-success'
        const textColor = status === 'out' ? 'text-danger' : status === 'low' ? 'text-alerte-text' : 'text-succes-text'
        const label = status === 'out' ? t('inventoryCatalog.outOfStockStatus') : status === 'low' ? t('inventoryCatalog.lowStockStatus') : t('inventoryCatalog.inStockStatus')
        return (
          <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${textColor}`}>
            <span className={`w-2 h-2 rounded-full ${dotColor}`} /> {label}
          </span>
        )
      },
    },
  ]

  if (!isLoading && products.length === 0 && !firstDayDismissed) {
    return (
      <DesktopFirstDay
        isOwner={isOwner}
        onAddFirstProduct={() => {
          localStorage.setItem(FIRST_DAY_DONE_KEY, 'true')
          setFirstDayDismissed(true)
          setCreating(true)
        }}
        onRecordArrival={() => {
          localStorage.setItem(FIRST_DAY_DONE_KEY, 'true')
          setFirstDayDismissed(true)
          navigate('/stock/arrivage')
        }}
        onImported={() => {
          localStorage.setItem(FIRST_DAY_DONE_KEY, 'true')
          setFirstDayDismissed(true)
          load()
        }}
      />
    )
  }

  return (
    <div className="p-4 sm:p-8 flex flex-col gap-5">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 text-[11px] font-extrabold uppercase tracking-wide text-terracotta">
            <span>{t('inventoryCatalog.categoriesTitle')}</span>
            {stockAsOf && <span className="text-info-text normal-case font-semibold">· {t('inventoryCatalog.stockAsOf', { time: new Date(stockAsOf).toLocaleTimeString() })}</span>}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-text">{t('inventoryCatalog.stockManagementLabel')}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={() => navigate('/stock/exports')} className="min-h-10 px-3.5 py-1.5 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text text-left">
            <Download size={16} />
            {t('inventoryCatalog.exportStockButton')}
          </button>
          {isOwner && (
            <button type="button" onClick={() => navigate('/stock/import')} className="min-h-10 px-3.5 py-1.5 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text">
              <Upload size={16} />
              {t('inventoryCatalog.importCatalogButton')}
            </button>
          )}
          <button type="button" onClick={() => setShowScanner(true)} className="min-h-10 px-3.5 py-1.5 rounded-xl border border-border-strong bg-bg-card flex items-center gap-2 text-sm font-bold text-text">
            <ScanBarcode size={16} />
            {t('inventoryCatalog.scanInventoryButton')}
          </button>
          <button type="button" onClick={() => setCreating(true)} className="min-h-10 px-3.5 py-1.5 rounded-xl bg-terracotta text-white flex items-center gap-2 text-sm font-bold">
            <Plus size={16} />
            {t('inventoryCatalog.addProductTitle')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.activeReferencesLabel')}</span>
            <Archive size={17} className="flex-none text-primary" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-text">{products.length}</span>
          <span className="text-xs sm:text-[13px] break-words font-semibold text-text-dim">{t('inventoryCatalog.categoriesSpreadCaption', { count: categories.length })}</span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.valuedStockLabel')}</span>
            <Wallet size={17} className="flex-none text-succes-text" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-text">{formatNumber(stockValue, locale)}</span>
          <span className="text-xs sm:text-[13px] break-words font-semibold text-succes-text">{t('inventoryCatalog.theoreticalMarginCaption', { value: avgMarginPct.toFixed(1) })}</span>
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.lowStockKpiLabel')}</span>
            <AlertTriangle size={17} className="flex-none text-alerte-text" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-alerte-text">{alerteCount}</span>
          {alerteCount > 0 && <span className="text-xs sm:text-[13px] break-words font-semibold text-text-dim">{t('inventoryCatalog.urgentRestockCaption')}</span>}
        </div>

        <div className="min-w-0 p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 break-words text-[11px] font-extrabold uppercase tracking-wide text-text-dim">{t('inventoryCatalog.outOfStockKpiLabel')}</span>
            <ShoppingCart size={17} className="flex-none text-terracotta" />
          </div>
          <span className="font-display amount text-2xl sm:text-3xl break-all font-extrabold text-terracotta">{ruptureCount}</span>
          {ruptureCount > 0 && <span className="text-xs sm:text-[13px] break-words font-semibold text-terracotta">{t('inventoryCatalog.blockedSalesCaption')}</span>}
        </div>
      </div>

      <HorizontalScroller>
        {pills.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setStatusFilter(c.id)}
            className={`flex-none px-4 py-2 rounded-lg text-sm whitespace-nowrap ${
              statusFilter === c.id
                ? 'bg-encre text-papier font-bold'
                : c.id === 'OUT'
                ? 'bg-[#FBE9E4] text-terracotta font-semibold'
                : c.id === 'LOW'
                ? 'bg-alerte-bg text-alerte-text font-semibold'
                : 'bg-bg-card border border-border-strong text-[#5C5147] font-semibold'
            }`}
          >
            {c.label}
          </button>
        ))}
      </HorizontalScroller>

      {error && <div className="text-[13px] font-semibold text-danger">{error}</div>}

      {isLoading ? (
        <div className="text-sm font-semibold text-text-dim">{t('common.loading')}</div>
      ) : (
        <>
          {canPrintLabels && selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-info-bg border border-info-border px-4 py-3">
              <span className="text-sm font-bold text-info-text">{t('labels.selection.count', { count: selectedIds.size })}</span>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setSelectedIds(new Set())} className="text-xs font-bold text-text-muted hover:underline">
                  {t('labels.selection.clear')}
                </button>
                <button
                  type="button"
                  onClick={printSelectedLabels}
                  className="min-h-9 px-4 rounded-xl bg-primary text-papier text-sm font-extrabold inline-flex items-center gap-2 hover:bg-primary-dark"
                >
                  <Printer size={15} />
                  {t('labels.selection.print')}
                </button>
              </div>
            </div>
          )}

          {filteredRows.length > 0 && (
            <Pagination
              page={page}
              pageCount={pageCount}
              onPageChange={setPage}
              rangeLabel={t('inventoryCatalog.showingRange', { from: (page - 1) * pageSize + 1, to: Math.min(page * pageSize, filteredRows.length), total: filteredRows.length })}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              onPageSizeChange={setPageSize}
            />
          )}

          <Table
            columns={columns}
            rows={pageRows}
            getRowKey={(p) => p.id}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={onSort}
            onRowClick={setEditingProduct}
            rowClassName={(p) => (p.quantity === 0 ? 'bg-[#FDF1EC]' : p.quantity <= p.alertThreshold ? 'bg-[#FDF6EA]' : '')}
            emptyMessage={t('registerSales.noProductMatch')}
          />
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {lastIntake && (
          <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-lg bg-info-bg text-info-text flex items-center justify-center flex-none"><Truck size={17} /></span>
              <span className="text-sm font-extrabold text-text break-words">{t('inventoryCatalog.lastArrivalCardTitle')}</span>
            </div>
            <p className="text-[13px] font-semibold text-text-dim">
              {t('inventoryCatalog.lastArrivalCaption', {
                units: lastIntake.totalUnits,
                date: formatDate(lastIntake.createdAt, locale, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
              })}
              {lastIntakeSupplier ? ` · ${lastIntakeSupplier}` : ''}
            </p>
            <button type="button" onClick={() => navigate('/stock/arrivage')} className="flex items-center gap-1 text-xs font-extrabold text-primary self-start">
              {t('inventoryCatalog.viewReceiptLink')} <ArrowRight size={12} />
            </button>
          </div>
        )}

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-[#FDF1EC] text-terracotta flex items-center justify-center flex-none"><Package size={17} /></span>
            <span className="text-sm font-extrabold text-text break-words">{t('inventoryCatalog.consignedGoodsCardTitle')}</span>
          </div>
          <p className="text-[13px] font-semibold text-text-dim">
            {t('resellerConsignment.openConsignmentCountSuffix', { count: resellerTotal?.openConsignmentCount ?? 0 })} · {t('resellerConsignment.resellerCount', { count: resellerTotal?.resellerCount ?? 0 })}
            {resellerTotal && resellerTotal.totalOutstanding > 0 ? ` · ${formatCurrency(resellerTotal.totalOutstanding)}` : ''}
          </p>
          <button type="button" onClick={() => navigate('/revendeurs')} className="flex items-center gap-1 text-xs font-extrabold text-primary self-start">
            {t('inventoryCatalog.viewResellersLink')} <ArrowRight size={12} />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-alerte-bg text-alerte-text flex items-center justify-center flex-none"><PackageSearch size={17} /></span>
            <span className="text-sm font-extrabold text-text break-words">{t('reportsAnalytics.stockAlertsTitle')}</span>
          </div>
          <p className="text-[13px] font-semibold text-text-dim">
            {t('reportsAnalytics.outOfStockCount', { count: ruptureCount })} · {t('reportsAnalytics.lowStockCount', { count: alerteCount })}
          </p>
          <button type="button" onClick={() => navigate('/stock/alertes')} className="flex items-center gap-1 text-xs font-extrabold text-primary self-start">
            {t('inventoryCatalog.viewDetailLink')} <ArrowRight size={12} />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-bg-card border border-border flex flex-col gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-info-bg text-primary flex items-center justify-center flex-none"><Truck size={17} /></span>
            <span className="text-sm font-extrabold text-text break-words">{t('inventoryCatalog.stockTransfersTitle')}</span>
          </div>
          <p className="text-[13px] font-semibold text-text-dim">{t('inventoryCatalog.stockTransfersCardCaption')}</p>
          <button type="button" onClick={() => navigate('/stock/transferts')} className="flex items-center gap-1 text-xs font-extrabold text-primary self-start">
            {t('inventoryCatalog.viewDetailLink')} <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <ProductSheetModalDesktop
        open={creating || !!editingProduct}
        product={editingProduct}
        onClose={() => {
          setCreating(false)
          setEditingProduct(null)
        }}
        onSaved={(justCreated) => {
          setCreating(false)
          setEditingProduct(null)
          // La ligne de stock initiale peut ne pas encore exister côté serveur au moment de ce
          // rechargement (event inventory async, cf. ProductSheetModalDesktop) : si le catalogue
          // rechargé montre encore 0 pour l'article qu'on vient de créer, on affiche la quantité déjà
          // connue côté client en attendant qu'un futur rechargement confirme la valeur serveur.
          load().then(() => {
            if (!justCreated) return
            setProducts((prev) => prev.map((p) =>
              p.id === justCreated.productId && p.quantity === 0
                ? { ...p, quantity: justCreated.quantity }
                : p,
            ))
          })
        }}
        onDeleted={() => {
          setEditingProduct(null)
          load()
        }}
      />

      <BarcodeScannerModal open={showScanner} onClose={() => setShowScanner(false)} onDetected={handleScanDetected} />
    </div>
  )
}
